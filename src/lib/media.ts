import sharp from 'sharp';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { mkdir, writeFile, access } from 'fs/promises';
import { dirname, extname, join } from 'path';

const MEDIA_PATH = process.env['MEDIA_PATH'] || './media';

export interface MediaDimensions {
  width: number;
  height: number;
}

export interface ProcessedMedia {
  filename: string;
  dimensions: MediaDimensions;
  sizeBytes: number;
  sha256: string;
}

export interface MediaVariants {
  original: ProcessedMedia;
  medium?: ProcessedMedia;
  thumb?: ProcessedMedia;
  poster?: ProcessedMedia; // For videos
}

const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.heic', '.webp'];
const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.mov', '.avi', '.mkv'];

const THUMB_SIZE = 200;
const MEDIUM_SIZE = 800;

export function isImageFormat(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return SUPPORTED_IMAGE_FORMATS.includes(ext);
}

export function isVideoFormat(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return SUPPORTED_VIDEO_FORMATS.includes(ext);
}

export function isSupportedFormat(filename: string): boolean {
  return isImageFormat(filename) || isVideoFormat(filename);
}

export function generateMediaPath(childId: number, date: Date, hash: string, extension: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return join(String(childId), String(year), month, `${hash}${extension}`);
}

export function generateThumbPath(originalPath: string): string {
  const dir = dirname(originalPath);
  const filename = originalPath.replace(dir + '/', '');
  return join(dir, 'thumbs', filename);
}

export function generateMediumPath(originalPath: string): string {
  const dir = dirname(originalPath);
  const filename = originalPath.replace(dir + '/', '');
  return join(dir, 'medium', filename);
}

export async function calculateSha256(buffer: Buffer): Promise<string> {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function ensureDirectoryExists(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function processImage(
  buffer: Buffer, 
  originalFilename: string,
  childId: number,
  takenAt: Date
): Promise<MediaVariants> {
  const sha256 = await calculateSha256(buffer);
  const extension = extname(originalFilename).toLowerCase();
  
  // Generate paths
  const relativePath = generateMediaPath(childId, takenAt, sha256, extension);
  const originalPath = join(MEDIA_PATH, relativePath);
  const thumbPath = join(MEDIA_PATH, generateThumbPath(relativePath));
  const mediumPath = join(MEDIA_PATH, generateMediumPath(relativePath));

  // Ensure directories exist
  await ensureDirectoryExists(originalPath);
  await ensureDirectoryExists(thumbPath);
  await ensureDirectoryExists(mediumPath);

  const variants: MediaVariants = {
    original: {
      filename: relativePath,
      dimensions: { width: 0, height: 0 },
      sizeBytes: buffer.length,
      sha256
    }
  };

  // Process original
  const originalImage = sharp(buffer);
  const originalMetadata = await originalImage.metadata();
  
  variants.original.dimensions = {
    width: originalMetadata.width || 0,
    height: originalMetadata.height || 0
  };

  // Save original if it doesn't exist
  if (!(await fileExists(originalPath))) {
    await writeFile(originalPath, buffer);
  }

  // Generate thumbnail
  const thumbBuffer = await originalImage
    .resize(THUMB_SIZE, THUMB_SIZE, { 
      fit: 'cover',
      position: 'centre'
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  if (!(await fileExists(thumbPath))) {
    await writeFile(thumbPath, thumbBuffer);
  }

  variants.thumb = {
    filename: generateThumbPath(relativePath),
    dimensions: { width: THUMB_SIZE, height: THUMB_SIZE },
    sizeBytes: thumbBuffer.length,
    sha256: await calculateSha256(thumbBuffer)
  };

  // Generate medium size if original is larger
  if (originalMetadata.width && originalMetadata.width > MEDIUM_SIZE) {
    const mediumBuffer = await originalImage
      .resize(MEDIUM_SIZE, null, { 
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    if (!(await fileExists(mediumPath))) {
      await writeFile(mediumPath, mediumBuffer);
    }

    const mediumMetadata = await sharp(mediumBuffer).metadata();
    variants.medium = {
      filename: generateMediumPath(relativePath),
      dimensions: {
        width: mediumMetadata.width || 0,
        height: mediumMetadata.height || 0
      },
      sizeBytes: mediumBuffer.length,
      sha256: await calculateSha256(mediumBuffer)
    };
  }

  return variants;
}

function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    
    let stdout = '';
    let stderr = '';

    ffmpeg.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    ffmpeg.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });
  });
}

export async function processVideo(
  buffer: Buffer,
  originalFilename: string,
  childId: number,
  takenAt: Date
): Promise<MediaVariants> {
  const sha256 = await calculateSha256(buffer);
  const originalExtension = extname(originalFilename).toLowerCase();
  
  // Force .mp4 for processed videos for web compatibility
  const processedExtension = '.mp4';
  const relativePath = generateMediaPath(childId, takenAt, sha256, processedExtension);
  const originalPath = join(MEDIA_PATH, relativePath);
  const thumbPath = join(MEDIA_PATH, generateThumbPath(relativePath.replace(processedExtension, '.jpg')));
  
  // Ensure directories exist
  await ensureDirectoryExists(originalPath);
  await ensureDirectoryExists(thumbPath);

  const variants: MediaVariants = {
    original: {
      filename: relativePath,
      dimensions: { width: 0, height: 0 },
      sizeBytes: 0,
      sha256
    }
  };

  // Save original buffer to temp file for ffmpeg processing
  const tempInputPath = `/tmp/${sha256}${originalExtension}`;
  await writeFile(tempInputPath, buffer);

  try {
    // Get video metadata
    const probeOutput = await runFfmpeg([
      '-i', tempInputPath,
      '-f', 'null',
      '-'
    ]);

    // Parse dimensions from ffmpeg output (basic regex parsing)
    const dimensionMatch = probeOutput.match(/Stream.*Video.*?(\d+)x(\d+)/);
    if (dimensionMatch) {
      variants.original.dimensions = {
        width: parseInt(dimensionMatch[1] || '0'),
        height: parseInt(dimensionMatch[2] || '0')
      };
    }

    // Process video if it doesn't exist
    if (!(await fileExists(originalPath))) {
      await runFfmpeg([
        '-i', tempInputPath,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23', // Good quality to size ratio
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart', // Web optimization
        '-y',
        originalPath
      ]);
    }

    // Get final file size
    const stats = await import('fs').then(fs => fs.promises.stat(originalPath));
    variants.original.sizeBytes = stats.size;

    // Generate poster frame
    if (!(await fileExists(thumbPath))) {
      await runFfmpeg([
        '-i', originalPath,
        '-ss', '00:00:01', // 1 second in
        '-vframes', '1',
        '-vf', `scale=${THUMB_SIZE}:${THUMB_SIZE}:force_original_aspect_ratio=increase,crop=${THUMB_SIZE}:${THUMB_SIZE}`,
        '-y',
        thumbPath
      ]);
    }

    // Get poster frame metadata
    const posterStats = await import('fs').then(fs => fs.promises.stat(thumbPath));
    const posterBuffer = await import('fs').then(fs => fs.promises.readFile(thumbPath));
    
    variants.poster = {
      filename: generateThumbPath(relativePath.replace(processedExtension, '.jpg')),
      dimensions: { width: THUMB_SIZE, height: THUMB_SIZE },
      sizeBytes: posterStats.size,
      sha256: await calculateSha256(posterBuffer)
    };

  } finally {
    // Clean up temp file
    try {
      await import('fs').then(fs => fs.promises.unlink(tempInputPath));
    } catch {
      // Ignore cleanup errors
    }
  }

  return variants;
}

export async function processMediaFile(
  buffer: Buffer,
  originalFilename: string,
  childId: number,
  takenAt: Date = new Date()
): Promise<MediaVariants> {
  if (!isSupportedFormat(originalFilename)) {
    throw new Error(`Unsupported file format: ${originalFilename}`);
  }

  if (isImageFormat(originalFilename)) {
    return processImage(buffer, originalFilename, childId, takenAt);
  } else {
    return processVideo(buffer, originalFilename, childId, takenAt);
  }
}