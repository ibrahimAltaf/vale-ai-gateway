import "server-only";

import Redis from "ioredis";

import { assertTenantScopedKey } from "@/server/cache/key";
import type { CacheStore } from "@/server/cache/store";
import type { CachedCompletion } from "@/types/domain";

export class RedisCacheStore implements CacheStore {
  private readonly redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 4_000,
      enableReadyCheck: true,
    });
  }

  async get(tenantId: string, key: string): Promise<CachedCompletion | null> {
    assertTenantScopedKey(tenantId, key);
    const raw = await this.redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedCompletion;
  }

  async set(tenantId: string, key: string, value: CachedCompletion, ttlSeconds: number): Promise<void> {
    assertTenantScopedKey(tenantId, key);
    await this.redis.set(key, JSON.stringify(value), "EX", Math.max(1, ttlSeconds));
  }

  async ping(): Promise<boolean> {
    try {
      const reply = await this.redis.ping();
      return reply === "PONG";
    } catch {
      return false;
    }
  }
}
