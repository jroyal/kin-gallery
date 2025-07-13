import Database from 'better-sqlite3';
import { z } from 'zod';

const DATABASE_PATH = process.env.DATABASE_PATH || './data/kin-gallery.db';

export const db = new Database(DATABASE_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Zod schemas for type safety
export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
  created_at: z.string(),
  deleted_at: z.string().nullable()
});

export const ChildSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  birthdate: z.string().nullable(),
  cover_media_id: z.number().nullable(),
  created_at: z.string(),
  deleted_at: z.string().nullable()
});

export const MediaSchema = z.object({
  id: z.number(),
  child_id: z.number(),
  filename: z.string(),
  original_filename: z.string(),
  type: z.enum(['photo', 'video']),
  taken_at: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  size_bytes: z.number(),
  sha256: z.string(),
  created_at: z.string(),
  deleted_at: z.string().nullable()
});

export const CommentSchema = z.object({
  id: z.number(),
  media_id: z.number(),
  user_id: z.number(),
  body: z.string().min(1),
  created_at: z.string(),
  deleted_at: z.string().nullable()
});

export const ReactionSchema = z.object({
  id: z.number(),
  media_id: z.number(),
  user_id: z.number(),
  created_at: z.string()
});

export type User = z.infer<typeof UserSchema>;
export type Child = z.infer<typeof ChildSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type Reaction = z.infer<typeof ReactionSchema>;

// Migration system
const MIGRATIONS = [
  {
    version: 1,
    up: () => {
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT NULL
        );

        CREATE INDEX idx_users_email ON users(email);
        CREATE INDEX idx_users_role ON users(role);
      `);
    }
  },
  {
    version: 2,
    up: () => {
      db.exec(`
        CREATE TABLE children (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          birthdate TEXT NULL,
          cover_media_id INTEGER NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT NULL,
          FOREIGN KEY (cover_media_id) REFERENCES media(id)
        );

        CREATE INDEX idx_children_name ON children(name);
      `);
    }
  },
  {
    version: 3,
    up: () => {
      db.exec(`
        CREATE TABLE media (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          child_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('photo', 'video')),
          taken_at TEXT NOT NULL,
          width INTEGER NULL,
          height INTEGER NULL,
          size_bytes INTEGER NOT NULL,
          sha256 TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT NULL,
          FOREIGN KEY (child_id) REFERENCES children(id)
        );

        CREATE INDEX idx_media_child_id ON media(child_id);
        CREATE INDEX idx_media_taken_at ON media(taken_at);
        CREATE INDEX idx_media_type ON media(type);
        CREATE INDEX idx_media_sha256 ON media(sha256);
        CREATE INDEX idx_media_created_at ON media(created_at);
      `);
    }
  },
  {
    version: 4,
    up: () => {
      db.exec(`
        CREATE TABLE comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          media_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          body TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT NULL,
          FOREIGN KEY (media_id) REFERENCES media(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE INDEX idx_comments_media_id ON comments(media_id);
        CREATE INDEX idx_comments_user_id ON comments(user_id);
        CREATE INDEX idx_comments_created_at ON comments(created_at);
      `);
    }
  },
  {
    version: 5,
    up: () => {
      db.exec(`
        CREATE TABLE reactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          media_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (media_id) REFERENCES media(id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          UNIQUE(media_id, user_id)
        );

        CREATE INDEX idx_reactions_media_id ON reactions(media_id);
        CREATE INDEX idx_reactions_user_id ON reactions(user_id);
      `);
    }
  }
];

function getCurrentVersion(): number {
  try {
    const result = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined;
    return result?.version || 0;
  } catch {
    // Table doesn't exist yet
    return 0;
  }
}

function setVersion(version: number): void {
  db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(version);
}

export function runMigrations(): void {
  // Create schema_version table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const currentVersion = getCurrentVersion();
  
  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      console.log(`Running migration ${migration.version}...`);
      migration.up();
      setVersion(migration.version);
    }
  }
}