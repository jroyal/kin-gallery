import { db, UserSchema, type User, runMigrations } from './db.js';
import type { APIContext } from 'astro';

const CF_ACCESS_JWT_HEADER = 'CF-Access-Jwt-Assertion';
const DEVELOPMENT_MODE = process.env['NODE_ENV'] !== 'production';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: 'admin' | 'user';
  isAdmin: boolean;
}

export interface CloudflareAccessPayload {
  email: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

// Simulated JWT payload for development
function createDevelopmentJWT(email: string): string {
  const payload: CloudflareAccessPayload = {
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    iss: 'https://dev.cloudflareaccess.com',
    aud: 'kin-gallery-dev'
  };
  
  // In development, we just base64 encode the payload (no signature verification)
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `header.${encodedPayload}.signature`;
}

function parseJWTPayload(token: string): CloudflareAccessPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1] || '', 'base64').toString());
    return payload as CloudflareAccessPayload;
  } catch {
    return null;
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function getOrCreateUser(email: string): User {
  // Ensure database is initialized
  runMigrations();
  
  if (!isValidEmail(email)) {
    throw new Error('Invalid email address');
  }

  // Check if user already exists
  const existingUser = db.prepare(`
    SELECT * FROM users 
    WHERE email = ? AND deleted_at IS NULL
  `).get(email) as User | undefined;

  if (existingUser) {
    return UserSchema.parse(existingUser);
  }

  // Check if this is the first user (should be admin)
  const userCount = db.prepare(`
    SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL
  `).get() as { count: number };

  const role = userCount.count === 0 ? 'admin' : 'user';

  // Create new user (name will be null initially, can be set during onboarding)
  const result = db.prepare(`
    INSERT INTO users (email, role)
    VALUES (?, ?)
  `).run(email, role);

  const newUser = db.prepare(`
    SELECT * FROM users WHERE id = ?
  `).get(result.lastInsertRowid) as User;

  return UserSchema.parse(newUser);
}

export function authenticateFromContext(context: APIContext): AuthenticatedUser | null {
  // Get JWT from header
  let jwtToken = context.request.headers.get(CF_ACCESS_JWT_HEADER);

  // In development mode, allow simulation via query parameter or create default user
  if (DEVELOPMENT_MODE && !jwtToken) {
    const simulateEmail = context.url.searchParams.get('simulate_user');
    if (simulateEmail) {
      jwtToken = createDevelopmentJWT(simulateEmail);
    } else {
      // Default development user
      jwtToken = createDevelopmentJWT('dev@example.com');
    }
  }

  if (!jwtToken) {
    return null;
  }

  // Parse JWT payload
  const payload = parseJWTPayload(jwtToken);
  if (!payload || !payload.email) {
    return null;
  }

  // Check token expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return null;
  }

  try {
    // Get or create user
    const user = getOrCreateUser(payload.email);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isAdmin: user.role === 'admin'
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

export function requireAuth(context: APIContext): AuthenticatedUser {
  const user = authenticateFromContext(context);
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

export function requireAdmin(context: APIContext): AuthenticatedUser {
  const user = requireAuth(context);
  if (!user.isAdmin) {
    throw new Error('Admin access required');
  }
  return user;
}

// Database queries for user management (lazy initialization)
let userQueries: any = null;

function getUserQueries() {
  if (!userQueries) {
    // Ensure database is initialized first
    runMigrations();
    
    userQueries = {
      getById: db.prepare(`
        SELECT * FROM users 
        WHERE id = ? AND deleted_at IS NULL
      `),

      getByEmail: db.prepare(`
        SELECT * FROM users 
        WHERE email = ? AND deleted_at IS NULL
      `),

      list: db.prepare(`
        SELECT * FROM users 
        WHERE deleted_at IS NULL 
        ORDER BY created_at DESC
      `),

      updateRole: db.prepare(`
        UPDATE users 
        SET role = ? 
        WHERE id = ? AND deleted_at IS NULL
      `),

      softDelete: db.prepare(`
        UPDATE users 
        SET deleted_at = datetime('now') 
        WHERE id = ? AND deleted_at IS NULL
      `)
    };
  }
  return userQueries;
}

export function updateUserRole(userId: number, role: 'admin' | 'user'): boolean {
  const queries = getUserQueries();
  const result = queries.updateRole.run(role, userId);
  return result.changes > 0;
}

export function updateUserName(userId: number, name: string): boolean {
  runMigrations();
  const result = db.prepare(`
    UPDATE users 
    SET name = ? 
    WHERE id = ? AND deleted_at IS NULL
  `).run(name, userId);
  return result.changes > 0;
}

export function getAllUsers(): User[] {
  const queries = getUserQueries();
  const users = queries.list.all() as User[];
  return users.map(user => UserSchema.parse(user));
}

export function getUserById(id: number): User | null {
  const queries = getUserQueries();
  const user = queries.getById.get(id) as User | undefined;
  return user ? UserSchema.parse(user) : null;
}

export function deleteUser(userId: number): boolean {
  const queries = getUserQueries();
  const result = queries.softDelete.run(userId);
  return result.changes > 0;
}

export function isOnboardingRequired(): boolean {
  // Ensure database is initialized
  runMigrations();
  
  // Check if there are any children in the database
  const childCount = db.prepare(`
    SELECT COUNT(*) as count FROM children WHERE deleted_at IS NULL
  `).get() as { count: number };
  
  return childCount.count === 0;
}

export function getUserCount(): number {
  // Ensure database is initialized
  runMigrations();
  
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL
  `).get() as { count: number };
  
  return result.count;
}

/**
 * Create appropriate headers for server-side API calls in development and production
 */
export function createServerSideHeaders(request: Request, simulateUser?: string): HeadersInit {
  const headers: HeadersInit = {};
  
  if (DEVELOPMENT_MODE) {
    // In development, simulate the Cloudflare Access JWT
    const devEmail = simulateUser || 
                    new URL(request.url).searchParams.get('simulate_user') || 
                    'dev@example.com';
    const devJWT = createDevelopmentJWT(devEmail);
    headers[CF_ACCESS_JWT_HEADER] = devJWT;
  } else {
    // In production, pass through the actual JWT from the request
    const jwt = request.headers.get(CF_ACCESS_JWT_HEADER);
    if (jwt) {
      headers[CF_ACCESS_JWT_HEADER] = jwt;
    }
  }
  
  return headers;
}