#!/usr/bin/env tsx

/**
 * Clean Install Script for KinGallery
 * 
 * This script performs a complete clean install by:
 * 1. Dropping/recreating the SQLite database schema
 * 2. Clearing all media files from the /media directory
 * 3. Preparing the system for first-run onboarding
 */

import { existsSync, rmSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import Database from 'better-sqlite3';

const DATABASE_PATH = process.env['DATABASE_PATH'] || './data/kin-gallery.db';
const MEDIA_PATH = process.env['MEDIA_PATH'] || './media';

function cleanDatabase(): void {
  console.log('🗄️ Cleaning database...');
  
  // Remove existing database files
  const dbPath = resolve(DATABASE_PATH);
  const dbShmPath = `${dbPath}-shm`;
  const dbWalPath = `${dbPath}-wal`;
  
  [dbPath, dbShmPath, dbWalPath].forEach(path => {
    if (existsSync(path)) {
      rmSync(path);
      console.log(`   Removed: ${path}`);
    }
  });
  
  // Ensure data directory exists
  const dataDir = resolve('./data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log(`   Created: ${dataDir}`);
  }
  
  console.log('✅ Database cleaned');
}

function cleanMediaDirectory(): void {
  console.log('📁 Cleaning media directory...');
  
  const mediaPath = resolve(MEDIA_PATH);
  
  if (existsSync(mediaPath)) {
    rmSync(mediaPath, { recursive: true, force: true });
    console.log(`   Removed: ${mediaPath}`);
  }
  
  // Recreate empty media directory
  mkdirSync(mediaPath, { recursive: true });
  console.log(`   Created: ${mediaPath}`);
  
  console.log('✅ Media directory cleaned');
}

function initializeDatabase(): void {
  console.log('🔧 Initializing fresh database...');
  
  const db = new Database(DATABASE_PATH);
  
  // Enable WAL mode and foreign keys
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  // Create schema_version table
  db.exec(`
    CREATE TABLE schema_version (
      version INTEGER PRIMARY KEY
    );
  `);
  
  // Run all migrations
  const migrations = [
    {
      version: 1,
      up: () => {
        db.exec(`
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NULL,
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
  
  for (const migration of migrations) {
    console.log(`   Running migration ${migration.version}...`);
    migration.up();
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
  }
  
  // Set final schema version
  db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(6);
  
  db.close();
  console.log('✅ Database initialized with fresh schema');
}

async function main(): Promise<void> {
  console.log('🚀 Starting KinGallery Clean Install...\n');
  
  try {
    cleanDatabase();
    cleanMediaDirectory();
    initializeDatabase();
    
    console.log('\n🎉 Clean install completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the application: npm run dev');
    console.log('2. Navigate to localhost:4321');
    console.log('3. Complete first-user onboarding flow');
    
  } catch (error) {
    console.error('\n❌ Clean install failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { cleanDatabase, cleanMediaDirectory, initializeDatabase };