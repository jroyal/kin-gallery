import type { APIRoute } from 'astro';
import { authenticateFromContext } from '../../../lib/auth.js';

export const GET: APIRoute = async (context) => {
  try {
    const user = authenticateFromContext(context);
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Not authenticated'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Authentication failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};