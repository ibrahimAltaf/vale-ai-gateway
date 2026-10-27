import { assertTenantScopedKey } from "@/server/cache/key";
import type { CachedCompletion } from "@/types/domain";

export interface CacheStore {
  get(tenantId: string, key: string): Promise<CachedCompletion | null>;
  set(tenantId: string, key: string, value: CachedCompletion, ttlSeconds: number): Promise<void>;
  ping(): Promise<boolean>;
}

interface MemoryEntry {
  value: CachedCompletion;
  expiresAt: number;
}

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, MemoryEntry>();

  async get(tenantId: string, key: string): Promise<CachedCompletion | null> {
    assertTenantScopedKey(tenantId, key);
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(tenantId: string, key: string, value: CachedCompletion, ttlSeconds: number): Promise<void> {
    assertTenantScopedKey(tenantId, key);
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async ping(): Promise<boolean> {
    return true;
  }
}

export class UnavailableCacheStore implements CacheStore {
  async get(): Promise<CachedCompletion | null> {
    throw new Error("Cache store unavailable.");
  }

  async set(): Promise<void> {
    throw new Error("Cache store unavailable.");
  }

  async ping(): Promise<boolean> {
    return false;
  }
}
