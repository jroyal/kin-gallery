import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { cleanDatabase, cleanMediaDirectory, initializeDatabase } from '../../scripts/clean-install';
import Database from 'better-sqlite3';

describe('Clean Install Script', () => {
  const testDataDir = resolve('./test-data');
  const testMediaDir = resolve('./test-media');
  const testDbPath = resolve(testDataDir, 'test.db');

  beforeEach(() => {
    // Set test environment variables
    process.env.DATABASE_PATH = testDbPath;
    process.env.MEDIA_PATH = testMediaDir;

    // Create test directories
    mkdirSync(testDataDir, { recursive: true });
    mkdirSync(testMediaDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true });
    }
    if (existsSync(testMediaDir)) {
      rmSync(testMediaDir, { recursive: true, force: true });
    }

    // Reset environment variables
    delete process.env.DATABASE_PATH;
    delete process.env.MEDIA_PATH;
  });

  describe('cleanDatabase', () => {
    it('should remove existing database files', () => {
      // Create fake database files
      const db = new Database(testDbPath);
      db.close();

      expect(existsSync(testDbPath)).toBe(true);

      cleanDatabase();

      expect(existsSync(testDbPath)).toBe(false);
    });

    it('should create data directory if it does not exist', () => {
      // Remove the test data directory
      if (existsSync(testDataDir)) {
        rmSync(testDataDir, { recursive: true });
      }

      expect(existsSync(testDataDir)).toBe(false);

      cleanDatabase();

      expect(existsSync(testDataDir)).toBe(true);
    });
  });

  describe('cleanMediaDirectory', () => {
    it('should remove existing media directory and recreate it', () => {
      // Create some test files in media directory
      const testFile = resolve(testMediaDir, 'test.jpg');
      mkdirSync(testMediaDir, { recursive: true });
      require('fs').writeFileSync(testFile, 'test content');

      expect(existsSync(testFile)).toBe(true);

      cleanMediaDirectory();

      expect(existsSync(testMediaDir)).toBe(true);
      expect(existsSync(testFile)).toBe(false);
    });

    it('should create media directory if it does not exist', () => {
      if (existsSync(testMediaDir)) {
        rmSync(testMediaDir, { recursive: true });
      }

      expect(existsSync(testMediaDir)).toBe(false);

      cleanMediaDirectory();

      expect(existsSync(testMediaDir)).toBe(true);
    });
  });

  describe('initializeDatabase', () => {
    it('should create database with proper schema', () => {
      cleanDatabase();
      initializeDatabase();

      expect(existsSync(testDbPath)).toBe(true);

      const db = new Database(testDbPath);

      // Check that all tables exist
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[];

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('children');
      expect(tableNames).toContain('media');
      expect(tableNames).toContain('comments');
      expect(tableNames).toContain('reactions');
      expect(tableNames).toContain('schema_version');

      // Check schema version
      const version = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number };
      expect(version.version).toBe(5);

      db.close();
    });

    it('should enable WAL mode and foreign keys', () => {
      cleanDatabase();
      initializeDatabase();

      const db = new Database(testDbPath);

      const journalMode = db.pragma('journal_mode', { simple: true });
      const foreignKeys = db.pragma('foreign_keys', { simple: true });

      expect(journalMode).toBe('wal');
      expect(foreignKeys).toBe(1);

      db.close();
    });

    it('should create proper indexes', () => {
      cleanDatabase();
      initializeDatabase();

      const db = new Database(testDbPath);

      const indexes = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[];

      const indexNames = indexes.map(i => i.name);
      
      // Check for expected indexes
      expect(indexNames).toContain('idx_users_email');
      expect(indexNames).toContain('idx_media_child_id');
      expect(indexNames).toContain('idx_comments_media_id');
      expect(indexNames).toContain('idx_reactions_media_id');

      db.close();
    });
  });

  describe('full clean install process', () => {
    it('should complete clean install without errors', () => {
      // Create some existing data
      const db = new Database(testDbPath);
      db.close();
      
      const testFile = resolve(testMediaDir, 'old-photo.jpg');
      require('fs').writeFileSync(testFile, 'old content');

      expect(existsSync(testDbPath)).toBe(true);
      expect(existsSync(testFile)).toBe(true);

      // Run clean install
      expect(() => {
        cleanDatabase();
        cleanMediaDirectory();
        initializeDatabase();
      }).not.toThrow();

      // Verify clean state
      expect(existsSync(testDbPath)).toBe(true);
      expect(existsSync(testMediaDir)).toBe(true);
      expect(existsSync(testFile)).toBe(false);

      // Verify database is functional
      const newDb = new Database(testDbPath);
      const result = newDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      expect(result.count).toBe(0);
      newDb.close();
    });
  });
});