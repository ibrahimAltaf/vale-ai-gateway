import { buildCacheKey } from "@/server/cache/key";
import type { CacheStore } from "@/server/cache/store";
import type { CachedCompletion, CacheKeyContext, CacheKeyResult, CacheStatus } from "@/types/domain";

export interface CacheLookup {
  status: CacheStatus;
  key: CacheKeyResult;
  entry: CachedCompletion | null;
}

export class CacheService {
  constructor(
    private readonly store: CacheStore,
    private readonly secret: string,
  ) {}

  ping(): Promise<boolean> {
    return this.store.ping();
  }

  buildKey(context: CacheKeyContext): CacheKeyResult {
    return buildCacheKey(context, this.secret);
  }

  async lookup(tenantId: string, key: CacheKeyResult, enabled: boolean): Promise<CacheLookup> {
    if (!enabled) {
      return { status: "bypassed", key, entry: null };
    }
    try {
      const entry = await this.store.get(tenantId, key.key);
      return { status: entry ? "hit" : "miss", key, entry };
    } catch {
      return { status: "unavailable", key, entry: null };
    }
  }

  async storeCompletion(
    tenantId: string,
    key: CacheKeyResult,
    value: CachedCompletion,
    enabled: boolean,
    ttlSeconds: number,
  ): Promise<void> {
    if (!enabled) return;
    try {
      await this.store.set(tenantId, key.key, value, ttlSeconds);
    } catch {
      // A cache write failure must not fail a request that was already screened and completed.
    }
  }
}
