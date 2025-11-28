/**
 * SQLite-backed disk cache for persistent storage.
 */

import type { GenerateRequest, GenerateResponse } from '../contracts/models';
import { GenerateResponseSchema } from '../contracts/models';
import { BaseCache, CacheConfigSchema } from './base';
import { z } from 'zod';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, statSync } from 'fs';
import { dirname } from 'path';

export const DiskCacheConfigSchema = CacheConfigSchema.extend({
  path: z.string().default('.cache/accuralai.sqlite'),
  sizeLimitMb: z.number().int().positive().optional(),
  vacuumOnStart: z.boolean().default(false),
  ensureDirectory: z.boolean().default(true),
});

export type DiskCacheConfig = z.infer<typeof DiskCacheConfigSchema>;

interface CacheRow {
  cache_key: string;
  payload: string;
  expires_at: number | null;
  updated_at: number;
}

export class DiskCache extends BaseCache {
  private db: Database.Database;
  public config: DiskCacheConfig;

  constructor(config?: Partial<DiskCacheConfig>) {
    super(config);
    this.config = DiskCacheConfigSchema.parse(config || {});

    if (this.config.ensureDirectory) {
      const dir = dirname(this.config.path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(this.config.path);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        cache_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        expires_at REAL,
        updated_at REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);
      CREATE INDEX IF NOT EXISTS idx_cache_updated ON cache(updated_at);
    `);

    if (this.config.vacuumOnStart) {
      this.db.exec('VACUUM');
    }

    this.updateStatsSize();
  }

  async get(
    key: string,
    _options: { request: GenerateRequest }
  ): Promise<GenerateResponse | null> {
    this.removeExpired();

    const row = this.db
      .prepare<[string], CacheRow>('SELECT payload, expires_at FROM cache WHERE cache_key = ?')
      .get(key);

    if (!row) {
      this.markMiss();
      return null;
    }

    if (row.expires_at && row.expires_at < Date.now()) {
      this.db.prepare('DELETE FROM cache WHERE cache_key = ?').run(key);
      this.markMiss();
      this.updateStatsSize();
      return null;
    }

    this.db.prepare('UPDATE cache SET updated_at = ? WHERE cache_key = ?').run(Date.now(), key);

    this.markHit();

    try {
      const response = GenerateResponseSchema.parse(JSON.parse(row.payload));
      return this.cloneResponse(response);
    } catch (error) {
      console.error('Failed to parse cached response:', error);
      await this.invalidate(key);
      this.markMiss();
      return null;
    }
  }

  async set(key: string, value: GenerateResponse, options?: { ttl?: number }): Promise<void> {
    const expiresAt = this.computeExpiry(options?.ttl);
    const payload = JSON.stringify(value);
    const now = Date.now();

    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO cache (cache_key, payload, expires_at, updated_at)
      VALUES (?, ?, ?, ?)
    `
      )
      .run(key, payload, expiresAt, now);

    this.removeExpired();
    this.enforceSizeLimit();
    this.updateStatsSize();
  }

  async invalidate(key: string): Promise<void> {
    this.db.prepare('DELETE FROM cache WHERE cache_key = ?').run(key);
    this.updateStatsSize();
  }

  async clear(): Promise<void> {
    this.db.exec('DELETE FROM cache');
    this.updateStatsSize();
  }

  close(): void {
    this.db.close();
  }

  private removeExpired(): void {
    const now = Date.now();
    this.db
      .prepare('DELETE FROM cache WHERE expires_at IS NOT NULL AND expires_at < ?')
      .run(now);
  }

  private enforceSizeLimit(): void {
    if (!this.config.sizeLimitMb) return;

    const byteLimit = this.config.sizeLimitMb * 1024 * 1024;

    try {
      const stats = statSync(this.config.path);
      let currentSize = stats.size;

      while (currentSize > byteLimit) {
        const oldest = this.db
          .prepare<[], { cache_key: string }>(
            'SELECT cache_key FROM cache ORDER BY updated_at ASC LIMIT 1'
          )
          .get();

        if (!oldest) break;

        this.db.prepare('DELETE FROM cache WHERE cache_key = ?').run(oldest.cache_key);
        this.markEviction();

        const newStats = statSync(this.config.path);
        currentSize = newStats.size;
      }
    } catch (error) {
      // Ignore errors
    }
  }

  private updateStatsSize(): void {
    const result = this.db
      .prepare<[], { count: number }>('SELECT COUNT(*) as count FROM cache')
      .get();

    this.stats.size = result?.count || 0;
  }
}

export async function createDiskCache(config?: Partial<DiskCacheConfig>): Promise<DiskCache> {
  return new DiskCache(config);
}
