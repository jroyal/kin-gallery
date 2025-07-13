import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ChildSchema } from '../../lib/db.js';
import { requireAuth, requireAdmin } from '../../lib/auth.js';

const CreateChildSchema = z.object({
  name: z.string().min(1).max(100),
  birthdate: z.string().optional()
});

const UpdateChildSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  birthdate: z.string().optional(),
  cover_media_id: z.number().optional()
});

export const GET: APIRoute = async (context) => {
  try {
    requireAuth(context);
    
    const children = db.prepare(`
      SELECT * FROM children 
      WHERE deleted_at IS NULL 
      ORDER BY created_at ASC
    `).all();

    return new Response(JSON.stringify({
      children: children.map(child => ChildSchema.parse(child))
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to fetch children'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    requireAdmin(context);
    
    const body = await context.request.json();
    const validated = CreateChildSchema.parse(body);

    const result = db.prepare(`
      INSERT INTO children (name, birthdate)
      VALUES (?, ?)
    `).run(validated.name, validated.birthdate || null);

    const child = db.prepare(`
      SELECT * FROM children WHERE id = ?
    `).get(result.lastInsertRowid);

    return new Response(JSON.stringify({
      child: ChildSchema.parse(child)
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to create child'
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
    requireAdmin(context);
    
    const body = await context.request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      throw new Error('Child ID is required');
    }

    const validated = UpdateChildSchema.parse(updates);
    
    const setParts: string[] = [];
    const values: any[] = [];
    
    if (validated.name !== undefined) {
      setParts.push('name = ?');
      values.push(validated.name);
    }
    
    if (validated.birthdate !== undefined) {
      setParts.push('birthdate = ?');
      values.push(validated.birthdate);
    }
    
    if (validated.cover_media_id !== undefined) {
      setParts.push('cover_media_id = ?');
      values.push(validated.cover_media_id);
    }
    
    if (setParts.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    values.push(id);
    
    const result = db.prepare(`
      UPDATE children 
      SET ${setParts.join(', ')} 
      WHERE id = ? AND deleted_at IS NULL
    `).run(...values);

    if (result.changes === 0) {
      throw new Error('Child not found');
    }

    const child = db.prepare(`
      SELECT * FROM children WHERE id = ?
    `).get(id);

    return new Response(JSON.stringify({
      child: ChildSchema.parse(child)
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to update child'
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
    requireAdmin(context);
    
    const body = await context.request.json();
    const { id } = body;
    
    if (!id) {
      throw new Error('Child ID is required');
    }

    const result = db.prepare(`
      UPDATE children 
      SET deleted_at = datetime('now') 
      WHERE id = ? AND deleted_at IS NULL
    `).run(id);

    if (result.changes === 0) {
      throw new Error('Child not found');
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
      error: error instanceof Error ? error.message : 'Failed to delete child'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};