import { randomBytes } from "node:crypto";

import { PUBLIC_TENANTS } from "@/data/catalogue";
import { sha256 } from "@/server/cache/key";
import { createId } from "@/server/domain/ids";
import { withSettingsDefaults } from "@/server/domain/settings";
import type {
  AuditRepository,
  CreatedApiKey,
  LedgerRepository,
  OperatingMetrics,
  OperatingMetricsStore,
  RequestRepository,
  TenantRepository,
} from "@/server/repositories/contracts";
import { SEEDED_LEDGER } from "@/server/seed/ledger";
import { seededRequests } from "@/server/seed/requests";
import type {
  ApiKeyRecord,
  AuditEvent,
  GatewayRequestMetadata,
  SavingsEntry,
  Tenant,
  TenantSettings,
} from "@/types/domain";

interface StoredKey {
  id: string;
  label: string;
  keyHash: string;
  prefix: string;
  createdAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
}

export interface TenantState extends Tenant {
  keys: StoredKey[];
  spendMicros: number;
  requestsToday: number;
  monthRequests: number;
  monthCacheHits: number;
}

export const SEEDED_METRICS: OperatingMetrics = {
  piiEntitiesProtected: 4831,
  estimatedSavingsMicros: 1_842_640_000,
  overheadTotalMs: 37 * 1248,
  overheadSamples: 1248,
  cacheHitsToday: 483,
};

export interface MemoryDatabase {
  tenants: Map<string, TenantState>;
  requests: GatewayRequestMetadata[];
  ledger: SavingsEntry[];
  audits: AuditEvent[];
  metrics: OperatingMetrics;
}

export function createMemoryDatabase(): MemoryDatabase {
  const tenants = new Map<string, TenantState>();
  for (const tenant of tenantSeeds()) {
    tenants.set(tenant.id, tenant);
  }
  return {
    tenants,
    requests: seededRequests(),
    ledger: SEEDED_LEDGER.map((entry) => ({ ...entry })),
    audits: [],
    metrics: { ...SEEDED_METRICS },
  };
}

export function demoTenantStates(): TenantState[] {
  return tenantSeeds();
}

export function createMemoryMetrics(db: MemoryDatabase): OperatingMetricsStore {
  return {
    async read() {
      return { ...db.metrics };
    },
    async recordCacheHit() {
      db.metrics.cacheHitsToday += 1;
    },
    async recordCompletion(piiCount, savingMicros, overheadMs) {
      db.metrics.piiEntitiesProtected += piiCount;
      db.metrics.estimatedSavingsMicros += savingMicros;
      db.metrics.overheadSamples += 1;
      db.metrics.overheadTotalMs += overheadMs;
    },
    async recordOverhead(overheadMs) {
      db.metrics.overheadSamples += 1;
      db.metrics.overheadTotalMs += overheadMs;
    },
  };
}

export function createTenantRepository(db: MemoryDatabase): TenantRepository {
  return {
    async findByKeyHash(keyHash) {
      for (const tenant of db.tenants.values()) {
        if (tenant.archivedAt) continue;
        const key = tenant.keys.find((item) => item.keyHash === keyHash && !item.revokedAt);
        if (key) return { tenant: toTenant(tenant), apiKeyId: key.id };
      }
      return null;
    },
    async touchKey(keyId) {
      for (const tenant of db.tenants.values()) {
        const key = tenant.keys.find((item) => item.id === keyId);
        if (key) key.lastUsedAt = new Date().toISOString();
      }
    },
    async get(tenantId) {
      const tenant = db.tenants.get(tenantId);
      return tenant ? toTenant(tenant) : null;
    },
    async list() {
      return [...db.tenants.values()].map(toTenant);
    },
    async create(input) {
      const id = createId("ten");
      const tenant = state(id, input.name, input.sector, undefined, {
        privacyMode: "strict",
        createdAt: new Date().toISOString(),
        settings: withSettingsDefaults(input.settings),
        spendMicros: 0,
        requestsToday: 0,
        monthRequests: 0,
        monthCacheHits: 0,
      });
      db.tenants.set(id, tenant);
      return toTenant(tenant);
    },
    async archive(tenantId) {
      const tenant = db.tenants.get(tenantId);
      if (!tenant) return null;
      tenant.archivedAt = new Date().toISOString();
      return toTenant(tenant);
    },
    async updateSettings(tenantId, settings) {
      const tenant = db.tenants.get(tenantId);
      if (!tenant || tenant.archivedAt) return null;
      tenant.settings = withSettingsDefaults({ ...settings, semanticCacheEnabled: false });
      return toTenant(tenant);
    },
    async listKeys(tenantId) {
      const tenant = db.tenants.get(tenantId);
      if (!tenant) return [];
      return tenant.keys.map((key) => toKey(tenant.id, key));
    },
    async createKey(tenantId, name) {
      const tenant = db.tenants.get(tenantId);
      if (!tenant || tenant.archivedAt) return null;
      return issueKey(tenant, name);
    },
    async revokeKey(tenantId, keyId) {
      const tenant = db.tenants.get(tenantId);
      const key = tenant?.keys.find((item) => item.id === keyId);
      if (!tenant || !key || key.revokedAt) return null;
      key.revokedAt = new Date().toISOString();
      return toKey(tenant.id, key);
    },
    async recordRequest(tenantId) {
      const tenant = db.tenants.get(tenantId);
      if (!tenant) return { allowed: false, spendMicros: 0 };
      if (tenant.requestsToday >= tenant.settings.dailyRequestLimit) {
        return { allowed: false, spendMicros: tenant.spendMicros };
      }
      tenant.requestsToday += 1;
      tenant.monthRequests += 1;
      return { allowed: true, spendMicros: tenant.spendMicros };
    },
    async addSpend(tenantId, actualMicros) {
      const tenant = db.tenants.get(tenantId);
      if (!tenant) return;
      tenant.spendMicros += actualMicros;
    },
    async recordCacheHit(tenantId) {
      const tenant = db.tenants.get(tenantId);
      if (!tenant) return;
      tenant.monthCacheHits += 1;
    },
    async stats(tenantId) {
      const tenant = db.tenants.get(tenantId);
      if (!tenant) return null;
      return {
        spendMicros: tenant.spendMicros,
        requestsToday: tenant.requestsToday,
        monthRequests: tenant.monthRequests,
        monthCacheHits: tenant.monthCacheHits,
      };
    },
  };
}

export function createRequestRepository(db: MemoryDatabase): RequestRepository {
  return {
    async insert(record) {
      db.requests.unshift(record);
    },
    async get(tenantId, requestId) {
      return db.requests.find((record) => record.tenantId === tenantId && record.id === requestId) ?? null;
    },
    async list(tenantId) {
      return db.requests.filter((record) => record.tenantId === tenantId);
    },
    async listAll() {
      return [...db.requests];
    },
  };
}

export function createLedgerRepository(db: MemoryDatabase): LedgerRepository {
  return {
    async insert(entry) {
      db.ledger.unshift(entry);
    },
    async list(tenantId) {
      return db.ledger.filter((entry) => entry.tenantId === tenantId);
    },
    async listAll() {
      return [...db.ledger];
    },
    async spendSince(tenantId, sinceIso) {
      return db.ledger
        .filter((entry) => entry.tenantId === tenantId && entry.createdAt >= sinceIso)
        .reduce((total, entry) => total + entry.actualMicros, 0);
    },
  };
}

export function createAuditRepository(db: MemoryDatabase): AuditRepository {
  return {
    async insert(event) {
      db.audits.unshift(event);
    },
    async list(tenantId) {
      return db.audits.filter((event) => event.tenantId === tenantId);
    },
  };
}

function toTenant(tenant: TenantState): Tenant {
  return {
    id: tenant.id,
    name: tenant.name,
    sector: tenant.sector,
    privacyMode: tenant.privacyMode,
    settings: withSettingsDefaults(tenant.settings),
    createdAt: tenant.createdAt,
    archivedAt: tenant.archivedAt,
  };
}

function toKey(tenantId: string, key: StoredKey): ApiKeyRecord {
  return {
    id: key.id,
    tenantId,
    keyHash: key.keyHash,
    label: key.label,
    prefix: key.prefix,
    createdAt: key.createdAt,
    revokedAt: key.revokedAt,
    lastUsedAt: key.lastUsedAt,
  };
}

function issueKey(tenant: TenantState, name: string): CreatedApiKey {
  const rawKey = `vk_${randomBytes(18).toString("hex")}`;
  const key: StoredKey = {
    id: createId("key"),
    label: name,
    keyHash: sha256(rawKey),
    prefix: rawKey.slice(0, 12),
    createdAt: new Date().toISOString(),
  };
  tenant.keys.push(key);
  return { record: toKey(tenant.id, key), rawKey };
}

function tenantSeeds(): TenantState[] {
  const settings = {
    semanticCacheEnabled: false,
    exactCacheEnabled: true,
    batchEligibilityDefault: false,
    preferredProviders: ["openai", "anthropic", "google"] as TenantSettings["preferredProviders"],
    enabledModels: [] as string[],
    fallbackPolicy: "fail_closed" as const,
    perRequestMaxMicros: 100_000_000,
    cacheTtlSeconds: 86_400,
    slug: "",
    description: "",
    environment: "development" as const,
  };

  return [
    state("ten_northstar", "Northstar Health UK", "Healthcare", "vk_demo_northstar_7f3a9c", {
      privacyMode: "strict",
      createdAt: "2026-01-15T00:00:00.000Z",
      settings: {
        ...settings,
        monthlyBudgetMicros: 5_000_000_000,
        dailyRequestLimit: 20000,
        fallbackModel: "gpt-4o-mini",
        spikeAlertThresholdMicros: 2_000_000_000,
      },
      spendMicros: 1_428_000_000,
      requestsToday: 640,
      monthRequests: 8420,
      monthCacheHits: 3469,
    }),
    state("ten_acme", "Acme Legal", "Legal", "vk_demo_acme_b21e44", {
      privacyMode: "strict",
      createdAt: "2026-01-15T00:00:00.000Z",
      settings: {
        ...settings,
        monthlyBudgetMicros: 3_000_000_000,
        dailyRequestLimit: 8000,
        fallbackModel: "claude-haiku-4.5",
        spikeAlertThresholdMicros: 1_200_000_000,
      },
      spendMicros: 486_160_000,
      requestsToday: 280,
      monthRequests: 3188,
      monthCacheHits: 874,
    }),
    state("ten_finedge", "FinEdge UK", "Financial services", "vk_demo_finedge_91cd02", {
      privacyMode: "strict",
      createdAt: "2026-01-15T00:00:00.000Z",
      settings: {
        ...settings,
        monthlyBudgetMicros: 8_000_000_000,
        dailyRequestLimit: 25000,
        fallbackModel: "gemini-2.5-flash",
        spikeAlertThresholdMicros: 2_500_000_000,
      },
      spendMicros: 1_000_000_000,
      requestsToday: 328,
      monthRequests: 7040,
      monthCacheHits: 2471,
    }),
  ];
}

function state(
  id: string,
  name: string,
  sector: string,
  apiKey: string | undefined,
  fields: Omit<TenantState, "id" | "name" | "sector" | "keys">,
): TenantState {
  if (apiKey) {
    const known = PUBLIC_TENANTS.find((tenant) => tenant.id === id);
    if (!known || known.apiKey !== apiKey) {
      throw new Error(`Demo tenant seed mismatch for ${id}.`);
    }
  }
  const keys: StoredKey[] = apiKey
    ? [
        {
          id: `key_${id}`,
          label: "Console demo key",
          keyHash: sha256(apiKey),
          prefix: apiKey.slice(0, 12),
          createdAt: fields.createdAt,
        },
      ]
    : [];
  return {
    id,
    name,
    sector,
    keys,
    ...fields,
  };
}
