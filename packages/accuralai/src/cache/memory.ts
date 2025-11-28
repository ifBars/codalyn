/**
 * In-memory LRU cache with TTL support.
 */

import type { GenerateRequest, GenerateResponse } from '../contracts/models';
import { BaseCache, CacheConfigSchema } from './base';
import { z } from 'zod';

export const MemoryCacheConfigSchema = CacheConfigSchema.extend({
  maxEntries: z.number().int().positive().optional(),
  eagerExpiry: z.boolean().default(true),
});

export type MemoryCacheConfig = z.infer<typeof MemoryCacheConfigSchema>;

interface CacheEntry {
  response: GenerateResponse;
  expiresAt: number | null;
  lastAccessed: number;
}

export class MemoryCache extends BaseCache {
  private store = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  public config: MemoryCacheConfig;

  constructor(config?: Partial<MemoryCacheConfig>) {
    super(config);
    this.config = MemoryCacheConfigSchema.parse(config || {});
  }

  async get(
    key: string,
    _options: { request: GenerateRequest }
  ): Promise<GenerateResponse | null> {
    if (this.config.eagerExpiry) {
      this.evictExpired();
    }

    const entry = this.store.get(key);
    if (!entry) {
      this.markMiss();
      return null;
    }

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.removeFromAccessOrder(key);
      this.markMiss();
      return null;
    }

    entry.lastAccessed = Date.now();
    this.updateAccessOrder(key);

    this.markHit();
    this.stats.size = this.store.size;

    return this.cloneResponse(entry.response);
  }

  async set(key: string, value: GenerateResponse, options?: { ttl?: number }): Promise<void> {
    const expiresAt = this.computeExpiry(options?.ttl);
    const entry: CacheEntry = {
      response: this.cloneResponse(value),
      expiresAt,
      lastAccessed: Date.now(),
    };

    if (this.store.has(key)) {
      this.removeFromAccessOrder(key);
    }

    this.store.set(key, entry);
    this.accessOrder.push(key);

    if (this.config.eagerExpiry) {
      this.evictExpired();
    }

    this.enforceCapacity();
    this.stats.size = this.store.size;
  }

  async invalidate(key: string): Promise<void> {
    if (this.store.delete(key)) {
      this.removeFromAccessOrder(key);
      this.stats.size = this.store.size;
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.accessOrder = [];
    this.stats.size = 0;
  }

  private enforceCapacity(): void {
    if (!this.config.maxEntries) return;

    while (this.store.size > this.config.maxEntries) {
      const lruKey = this.accessOrder[0];
      if (lruKey) {
        this.store.delete(lruKey);
        this.accessOrder.shift();
        this.markEviction();
      } else {
        break;
      }
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.store.delete(key);
      this.removeFromAccessOrder(key);
      this.markEviction();
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

export async function createMemoryCache(
  config?: Partial<MemoryCacheConfig>
): Promise<MemoryCache> {
  return new MemoryCache(config);
}
