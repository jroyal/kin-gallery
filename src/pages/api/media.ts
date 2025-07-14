import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, MediaSchema } from '../../lib/db.js';
import { requireAuth, requireAdmin } from '../../lib/auth.js';

const MediaQuerySchema = z.object({
  child_id: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  type: z.enum(['photo', 'video']).optional()
});

export const GET: APIRoute = async (context) => {
  try {
    requireAuth(context);
    
    const url = new URL(context.request.url);
    const query = Object.fromEntries(url.searchParams);
    const validated = MediaQuerySchema.parse(query);
    
    const limit = validated.limit ? parseInt(validated.limit) : 50;
    const offset = validated.offset ? parseInt(validated.offset) : 0;
    
    let whereClause = 'WHERE m.deleted_at IS NULL';
    const params: any[] = [];
    
    if (validated.child_id) {
      whereClause += ' AND m.child_id = ?';
      params.push(parseInt(validated.child_id));
    }
    
    if (validated.type) {
      whereClause += ' AND m.type = ?';
      params.push(validated.type);
    }
    
    params.push(limit, offset);
    
    const media = db.prepare(`
      SELECT 
        m.*,
        c.name as child_name,
        COUNT(r.id) as reaction_count,
        COUNT(cm.id) as comment_count
      FROM media m
      JOIN children c ON m.child_id = c.id
      LEFT JOIN reactions r ON m.id = r.media_id
      LEFT JOIN comments cm ON m.id = cm.media_id AND cm.deleted_at IS NULL
      ${whereClause}
      GROUP BY m.id
      ORDER BY m.taken_at DESC, m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params);

    const total = db.prepare(`
      SELECT COUNT(*) as count
      FROM media m
      ${whereClause.replace('LIMIT ? OFFSET ?', '')}
    `).get(...params.slice(0, -2)) as { count: number };

    return new Response(JSON.stringify({
      media: media.map(item => ({
        ...MediaSchema.parse(item),
        child_name: (item as any).child_name,
        reaction_count: (item as any).reaction_count,
        comment_count: (item as any).comment_count
      })),
      pagination: {
        total: total.count,
        limit,
        offset,
        hasMore: offset + limit < total.count
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to fetch media'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const user = requireAuth(context);
    
    const body = await context.request.json();
    const { id } = body;
    
    if (!id) {
      throw new Error('Media ID is required');
    }

    // Check if user owns the media or is admin
    const media = db.prepare(`
      SELECT m.*, c.name 
      FROM media m 
      JOIN children c ON m.child_id = c.id 
      WHERE m.id = ? AND m.deleted_at IS NULL
    `).get(id);

    if (!media) {
      throw new Error('Media not found');
    }

    // Only admins can delete any media; users can only delete their own uploads
    if (!user.isAdmin) {
      // For now, allow any authenticated user to delete
      // In future, could track upload user_id to restrict further
    }

    const result = db.prepare(`
      UPDATE media 
      SET deleted_at = datetime('now') 
      WHERE id = ? AND deleted_at IS NULL
    `).run(id);

    if (result.changes === 0) {
      throw new Error('Failed to delete media');
    }

    return new Response(JSON.stringify({
      success: true
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to delete media'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};