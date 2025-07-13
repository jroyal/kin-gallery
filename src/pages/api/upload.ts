import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';
import { processMediaFile, isSupportedFormat } from '../../lib/media.js';

const UploadSchema = z.object({
  child_id: z.number(),
  taken_at: z.string().optional()
});

export const POST: APIRoute = async (context) => {
  try {
    const user = requireAuth(context);
    
    const formData = await context.request.formData();
    const file = formData.get('file') as File;
    const childIdStr = formData.get('child_id') as string;
    const takenAtStr = formData.get('taken_at') as string;
    
    if (!file) {
      throw new Error('No file provided');
    }
    
    if (!childIdStr) {
      throw new Error('Child ID is required');
    }

    const childId = parseInt(childIdStr);
    if (isNaN(childId)) {
      throw new Error('Invalid child ID');
    }

    // Verify child exists
    const child = db.prepare(`
      SELECT id FROM children 
      WHERE id = ? AND deleted_at IS NULL
    `).get(childId);

    if (!child) {
      throw new Error('Child not found');
    }

    // Check file format
    if (!isSupportedFormat(file.name)) {
      throw new Error(`Unsupported file format: ${file.name}`);
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Parse taken_at date
    const takenAt = takenAtStr ? new Date(takenAtStr) : new Date();
    if (isNaN(takenAt.getTime())) {
      throw new Error('Invalid taken_at date');
    }

    // Process media file
    const variants = await processMediaFile(buffer, file.name, childId, takenAt);
    
    // Determine media type
    const mediaType = file.type.startsWith('video/') ? 'video' : 'photo';
    
    // Save to database
    const result = db.prepare(`
      INSERT INTO media (
        child_id, filename, original_filename, type, taken_at, 
        width, height, size_bytes, sha256
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      childId,
      variants.original.filename,
      file.name,
      mediaType,
      takenAt.toISOString(),
      variants.original.dimensions.width,
      variants.original.dimensions.height,
      variants.original.sizeBytes,
      variants.original.sha256
    );

    const media = db.prepare(`
      SELECT m.*, c.name as child_name 
      FROM media m 
      JOIN children c ON m.child_id = c.id 
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    return new Response(JSON.stringify({
      media,
      variants
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Upload failed'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};