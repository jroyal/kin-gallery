import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin, getAllUsers, updateUserRole, deleteUser, getUserById } from '../../../lib/auth.js';

const UpdateUserSchema = z.object({
  role: z.enum(['admin', 'user'])
});

export const GET: APIRoute = async (context) => {
  try {
    requireAdmin(context);
    
    const users = getAllUsers();
    
    return new Response(JSON.stringify({
      users
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to fetch users'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 500,
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
      throw new Error('User ID is required');
    }

    const validated = UpdateUserSchema.parse(updates);
    
    // Check if user exists
    const user = getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }

    const success = updateUserRole(id, validated.role);
    if (!success) {
      throw new Error('Failed to update user role');
    }

    const updatedUser = getUserById(id);
    
    return new Response(JSON.stringify({
      user: updatedUser
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to update user'
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
    const currentUser = requireAdmin(context);
    
    const body = await context.request.json();
    const { id } = body;
    
    if (!id) {
      throw new Error('User ID is required');
    }

    // Prevent self-deletion
    if (id === currentUser.id) {
      throw new Error('Cannot delete your own account');
    }

    const success = deleteUser(id);
    if (!success) {
      throw new Error('User not found or already deleted');
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
      error: error instanceof Error ? error.message : 'Failed to delete user'
    }), {
      status: error instanceof Error && error.message.includes('required') ? 401 : 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};