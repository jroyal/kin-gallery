import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, CommentSchema } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';

const CreateCommentSchema = z.object({
  media_id: z.number(),
  body: z.string().min(1).max(1000)
});

const UpdateCommentSchema = z.object({
  body: z.string().min(1).max(1000)
});

export const GET: APIRoute = async (context) => {
  try {
    requireAuth(context);
    
    const url = new URL(context.request.url);
    const mediaId = url.searchParams.get('media_id');
    
    if (!mediaId) {
      throw new Error('Media ID is required');
    }

    const comments = db.prepare(`
      SELECT 
        c.*,
        u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.media_id = ? AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
    `).all(parseInt(mediaId));

    return new Response(JSON.stringify({
      comments: comments.map(comment => ({
        ...CommentSchema.parse(comment),
        user_email: comment.user_email
      }))
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to fetch comments'
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
    const validated = CreateCommentSchema.parse(body);

    // Verify media exists
    const media = db.prepare(`
      SELECT id FROM media 
      WHERE id = ? AND deleted_at IS NULL
    `).get(validated.media_id);

    if (!media) {
      throw new Error('Media not found');
    }

    const result = db.prepare(`
      INSERT INTO comments (media_id, user_id, body)
      VALUES (?, ?, ?)
    `).run(validated.media_id, user.id, validated.body);

    const comment = db.prepare(`
      SELECT 
        c.*,
        u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    return new Response(JSON.stringify({
      comment: {
        ...CommentSchema.parse(comment),
        user_email: comment.user_email
      }
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to create comment'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

export const PUT: APIRoute = async (context) => {
  try {
    const user = requireAuth(context);
    
    const body = await context.request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      throw new Error('Comment ID is required');
    }

    const validated = UpdateCommentSchema.parse(updates);

    // Check if user owns the comment or is admin
    const existingComment = db.prepare(`
      SELECT user_id FROM comments 
      WHERE id = ? AND deleted_at IS NULL
    `).get(id) as { user_id: number } | undefined;

    if (!existingComment) {
      throw new Error('Comment not found');
    }

    if (existingComment.user_id !== user.id && !user.isAdmin) {
      throw new Error('Permission denied');
    }

    const result = db.prepare(`
      UPDATE comments 
      SET body = ? 
      WHERE id = ? AND deleted_at IS NULL
    `).run(validated.body, id);

    if (result.changes === 0) {
      throw new Error('Failed to update comment');
    }

    const comment = db.prepare(`
      SELECT 
        c.*,
        u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(id);

    return new Response(JSON.stringify({
      comment: {
        ...CommentSchema.parse(comment),
        user_email: comment.user_email
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to update comment'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 400,
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
      throw new Error('Comment ID is required');
    }

    // Check if user owns the comment or is admin
    const existingComment = db.prepare(`
      SELECT user_id FROM comments 
      WHERE id = ? AND deleted_at IS NULL
    `).get(id) as { user_id: number } | undefined;

    if (!existingComment) {
      throw new Error('Comment not found');
    }

    if (existingComment.user_id !== user.id && !user.isAdmin) {
      throw new Error('Permission denied');
    }

    const result = db.prepare(`
      UPDATE comments 
      SET deleted_at = datetime('now') 
      WHERE id = ? AND deleted_at IS NULL
    `).run(id);

    if (result.changes === 0) {
      throw new Error('Failed to delete comment');
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
      error: error instanceof Error ? error.message : 'Failed to delete comment'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};