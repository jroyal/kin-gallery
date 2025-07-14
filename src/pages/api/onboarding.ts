import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ChildSchema } from '../../lib/db.js';
import { requireAuth, isOnboardingRequired, updateUserName } from '../../lib/auth.js';

const OnboardingSchema = z.object({
  user: z.object({
    name: z.string().min(1).max(100).optional()
  }).optional(),
  children: z.array(z.object({
    name: z.string().min(1).max(100),
    birthdate: z.string().optional()
  })).min(1).max(10)
});

export const GET: APIRoute = async (context) => {
  try {
    const user = requireAuth(context);
    
    return new Response(JSON.stringify({
      required: isOnboardingRequired(),
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to get onboarding status'
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
    const user = requireAuth(context);
    
    // Only allow onboarding if it's actually required
    if (!isOnboardingRequired()) {
      return new Response(JSON.stringify({
        error: 'Onboarding has already been completed'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    const body = await context.request.json();
    const validated = OnboardingSchema.parse(body);
    
    // Update user name if provided
    if (validated.user?.name) {
      updateUserName(user.id, validated.user.name);
    }
    
    // Create children in a transaction
    const createChild = db.prepare(`
      INSERT INTO children (name, birthdate)
      VALUES (?, ?)
    `);
    
    const getChild = db.prepare(`
      SELECT * FROM children WHERE id = ?
    `);
    
    const createChildrenTransaction = db.transaction((children) => {
      const createdChildren = [];
      for (const child of children) {
        const result = createChild.run(child.name, child.birthdate || null);
        const newChild = getChild.get(result.lastInsertRowid);
        createdChildren.push(ChildSchema.parse(newChild));
      }
      return createdChildren;
    });
    
    const createdChildren = createChildrenTransaction(validated.children);
    
    return new Response(JSON.stringify({
      success: true,
      children: createdChildren,
      message: 'Onboarding completed successfully'
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to complete onboarding'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};