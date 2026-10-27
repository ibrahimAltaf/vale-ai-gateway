import type {
  ApiKeyRecord,
  AuditEvent,
  GatewayRequestMetadata,
  SavingsEntry,
  Tenant,
  TenantSettings,
} from "@/types/domain";

export interface ResolvedCredential {
  tenant: Tenant;
  apiKeyId: string;
}

export interface CreatedApiKey {
  record: ApiKeyRecord;
  rawKey: string;
}

export interface TenantRepository {
  findByKeyHash(keyHash: string): Promise<ResolvedCredential | null>;
  touchKey(keyId: string): Promise<void>;
  get(tenantId: string): Promise<Tenant | null>;
  list(): Promise<Tenant[]>;
  create(input: { name: string; sector: string; settings: TenantSettings }): Promise<Tenant>;
  archive(tenantId: string): Promise<Tenant | null>;
  updateSettings(tenantId: string, settings: TenantSettings): Promise<Tenant | null>;
  listKeys(tenantId: string): Promise<ApiKeyRecord[]>;
  createKey(tenantId: string, name: string): Promise<CreatedApiKey | null>;
  revokeKey(tenantId: string, keyId: string): Promise<ApiKeyRecord | null>;
  recordRequest(tenantId: string): Promise<{ allowed: boolean; spendMicros: number }>;
  addSpend(tenantId: string, actualMicros: number): Promise<void>;
  recordCacheHit(tenantId: string): Promise<void>;
  stats(tenantId: string): Promise<{
    spendMicros: number;
    requestsToday: number;
    monthRequests: number;
    monthCacheHits: number;
  } | null>;
}

export interface RequestRepository {
  insert(record: GatewayRequestMetadata): Promise<void>;
  get(tenantId: string, requestId: string): Promise<GatewayRequestMetadata | null>;
  list(tenantId: string): Promise<GatewayRequestMetadata[]>;
  listAll(): Promise<GatewayRequestMetadata[]>;
}

export interface LedgerRepository {
  insert(entry: SavingsEntry): Promise<void>;
  list(tenantId: string): Promise<SavingsEntry[]>;
  listAll(): Promise<SavingsEntry[]>;
  spendSince(tenantId: string, sinceIso: string): Promise<number>;
}

export interface AuditRepository {
  insert(event: AuditEvent): Promise<void>;
  list(tenantId: string): Promise<AuditEvent[]>;
}

export interface OperatingMetrics {
  piiEntitiesProtected: number;
  estimatedSavingsMicros: number;
  overheadTotalMs: number;
  overheadSamples: number;
  cacheHitsToday: number;
}

export interface OperatingMetricsStore {
  read(): Promise<OperatingMetrics>;
  recordCacheHit(): Promise<void>;
  recordCompletion(piiCount: number, savingMicros: number, overheadMs: number): Promise<void>;
  recordOverhead(overheadMs: number): Promise<void>;
}
