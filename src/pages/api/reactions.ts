import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';

const ToggleReactionSchema = z.object({
  media_id: z.number()
});

export const GET: APIRoute = async (context) => {
  try {
    requireAuth(context);
    
    const url = new URL(context.request.url);
    const mediaId = url.searchParams.get('media_id');
    
    if (!mediaId) {
      throw new Error('Media ID is required');
    }

    const reactions = db.prepare(`
      SELECT 
        r.*,
        u.email as user_email
      FROM reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.media_id = ?
      ORDER BY r.created_at DESC
    `).all(parseInt(mediaId));

    const count = db.prepare(`
      SELECT COUNT(*) as count
      FROM reactions
      WHERE media_id = ?
    `).get(parseInt(mediaId)) as { count: number };

    return new Response(JSON.stringify({
      reactions,
      count: count.count
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to fetch reactions'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const user = requireAuth(context);
    
    const body = await context.request.json();
    const validated = ToggleReactionSchema.parse(body);

    // Verify media exists
    const media = db.prepare(`
      SELECT id FROM media 
      WHERE id = ? AND deleted_at IS NULL
    `).get(validated.media_id);

    if (!media) {
      throw new Error('Media not found');
    }

    // Check if user already reacted
    const existingReaction = db.prepare(`
      SELECT id FROM reactions 
      WHERE media_id = ? AND user_id = ?
    `).get(validated.media_id, user.id);

    if (existingReaction) {
      // Remove reaction (toggle off)
      db.prepare(`
        DELETE FROM reactions 
        WHERE media_id = ? AND user_id = ?
      `).run(validated.media_id, user.id);

      return new Response(JSON.stringify({
        action: 'removed',
        reacted: false
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } else {
      // Add reaction (toggle on)
      db.prepare(`
        INSERT INTO reactions (media_id, user_id)
        VALUES (?, ?)
      `).run(validated.media_id, user.id);

      return new Response(JSON.stringify({
        action: 'added',
        reacted: true
      }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to toggle reaction'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};