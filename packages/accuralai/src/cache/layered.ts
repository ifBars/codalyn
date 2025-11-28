/**
 * Layered cache combining memory and disk for optimal performance.
 */

import type { GenerateRequest, GenerateResponse } from '../contracts/models';
import type { Cache } from '../contracts/protocols';
import { BaseCache, CacheConfigSchema } from './base';
import { createMemoryCache, type MemoryCacheConfig } from './memory';
import { createDiskCache, type DiskCacheConfig } from './disk';
import { z } from 'zod';

export const LayeredCacheConfigSchema = CacheConfigSchema.extend({
  memory: z.record(z.unknown()).default({}),
  disk: z.record(z.unknown()).default({}),
  promoteOnHit: z.boolean().default(true),
});

export type LayeredCacheConfig = z.infer<typeof LayeredCacheConfigSchema>;

export class LayeredCache extends BaseCache {
  private memory: Cache;
  private disk: Cache;
  public config: LayeredCacheConfig;

  constructor(memory: Cache, disk: Cache, config?: Partial<LayeredCacheConfig>) {
    super(config);
    this.config = LayeredCacheConfigSchema.parse(config || {});
    this.memory = memory;
    this.disk = disk;
  }

  async get(
    key: string,
    options: { request: GenerateRequest }
  ): Promise<GenerateResponse | null> {
    const memoryResult = await this.memory.get(key, options);
    if (memoryResult) {
      this.markHit();
      return this.cloneResponse(memoryResult);
    }

    const diskResult = await this.disk.get(key, options);
    if (!diskResult) {
      this.markMiss();
      return null;
    }

    if (this.config.promoteOnHit) {
      await this.memory.set(key, diskResult);
    }

    this.markHit();
    return this.cloneResponse(diskResult);
  }

  async set(key: string, value: GenerateResponse, options?: { ttl?: number }): Promise<void> {
    await Promise.all([this.memory.set(key, value, options), this.disk.set(key, value, options)]);
  }

  async invalidate(key: string): Promise<void> {
    await Promise.all([this.memory.invalidate(key), this.disk.invalidate(key)]);
  }

  async clear(): Promise<void> {
    await Promise.all([
      (this.memory as any).clear?.(),
      (this.disk as any).clear?.(),
    ].filter(Boolean));
  }

  close(): void {
    if ('close' in this.disk && typeof (this.disk as any).close === 'function') {
      (this.disk as any).close();
    }
  }
}

export async function createLayeredCache(config?: {
  memory?: Partial<MemoryCacheConfig>;
  disk?: Partial<DiskCacheConfig>;
  promoteOnHit?: boolean;
}): Promise<LayeredCache> {
  const memoryCache = await createMemoryCache(config?.memory);
  const diskCache = await createDiskCache(config?.disk);

  return new LayeredCache(memoryCache, diskCache, {
    promoteOnHit: config?.promoteOnHit,
  });
}
