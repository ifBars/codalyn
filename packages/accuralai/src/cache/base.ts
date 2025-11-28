/**
 * Base cache class with common functionality.
 */

import type { GenerateRequest, GenerateResponse } from '../contracts/models';
import type { Cache, CacheStats } from '../contracts/protocols';
import { z } from 'zod';

export const CacheConfigSchema = z.object({
  defaultTtl: z.number().int().positive().optional(),
  enableStats: z.boolean().default(true),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

export abstract class BaseCache implements Cache {
  public config: CacheConfig;
  public stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    evictions: 0,
  };

  constructor(config?: Partial<CacheConfig>) {
    this.config = CacheConfigSchema.parse(config || {});
  }

  abstract get(
    key: string,
    options: { request: GenerateRequest }
  ): Promise<GenerateResponse | null>;
  abstract set(key: string, value: GenerateResponse, options?: { ttl?: number }): Promise<void>;
  abstract invalidate(key: string): Promise<void>;

  getStats(): CacheStats {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? this.stats.hits / (this.stats.hits + this.stats.misses)
        : 0;

    return {
      ...this.stats,
      hitRate: parseFloat(hitRate.toFixed(4)),
    };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      evictions: 0,
    };
  }

  protected markHit(): void {
    if (this.config.enableStats) {
      this.stats.hits++;
    }
  }

  protected markMiss(): void {
    if (this.config.enableStats) {
      this.stats.misses++;
    }
  }

  protected markEviction(): void {
    if (this.config.enableStats && this.stats.evictions !== undefined) {
      this.stats.evictions++;
    }
  }

  protected computeExpiry(ttl?: number): number | null {
    const ttlSeconds = ttl ?? this.config.defaultTtl;
    return ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
  }

  protected cloneResponse(response: GenerateResponse): GenerateResponse {
    return JSON.parse(JSON.stringify(response));
  }
}
