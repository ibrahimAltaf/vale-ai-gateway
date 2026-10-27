import "server-only";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

import type {
  AuditRepository,
  LedgerRepository,
  OperatingMetrics,
  OperatingMetricsStore,
  RequestRepository,
  ResolvedCredential,
  TenantRepository,
} from "@/server/repositories/contracts";
import { randomBytes } from "node:crypto";

import { sha256 } from "@/server/cache/key";
import { createId } from "@/server/domain/ids";
import { withSettingsDefaults } from "@/server/domain/settings";
import { demoTenantStates } from "@/server/repositories/memory";
import type {
  AuditEvent,
  CacheStatus,
  GatewayRequestMetadata,
  PiiType,
  ProviderId,
  SavingsEntry,
  SavingReason,
  ApiKeyRecord,
  Tenant,
  TenantSettings,
} from "@/types/domain";

type Sql = NeonQueryFunction<false, false>;

let client: Sql | undefined;
let ready: Promise<void> | undefined;

export function postgresClient(databaseUrl: string): Sql {
  client ??= neon(databaseUrl);
  return client;
}

export function prepareDatabase(databaseUrl: string): Promise<void> {
  ready ??= applySchema(databaseUrl).catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

async function applySchema(databaseUrl: string): Promise<void> {
  const migrationUrl = process.env.DATABASE_URL_UNPOOLED || databaseUrl;
  const sql = neon(migrationUrl);
  const schemaPath = path.join(process.cwd(), "src", "server", "repositories", "schema.sql");
  const statements = readFileSync(schemaPath, "utf8")
    .split(";")
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((statement) => statement.length > 0);
  for (const statement of statements) {
    await sql.query(statement);
  }
  await applyMigrations(sql);
  await seedIfEmpty(postgresClient(databaseUrl));
}

async function applyMigrations(sql: Sql): Promise<void> {
  const migrationDir = path.join(process.cwd(), "src", "server", "repositories", "migrations");
  const files = readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const existing = await sql`SELECT id FROM schema_migrations WHERE id = ${id}`;
    if (existing.length > 0) continue;
    const body = readFileSync(path.join(migrationDir, file), "utf8");
    const statements = body
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);
    for (const statement of statements) {
      await sql.query(statement);
    }
    await sql`INSERT INTO schema_migrations (id) VALUES (${id}) ON CONFLICT (id) DO NOTHING`;
  }
}

async function seedIfEmpty(sql: Sql): Promise<void> {
  const existing = await sql`SELECT COUNT(*)::int AS count FROM tenants`;
  const count = num(row(existing).count);
  if (count === 0) {
    for (const tenant of demoTenantStates()) {
      const key = tenant.keys[0];
      if (!key) continue;
      await sql`
        INSERT INTO tenants (
          id, name, sector, privacy_mode, settings, created_at,
          spend_micros, requests_today, month_requests, month_cache_hits
        ) VALUES (
          ${tenant.id},
          ${tenant.name},
          ${tenant.sector},
          ${tenant.privacyMode},
          ${JSON.stringify(withSettingsDefaults(tenant.settings))}::jsonb,
          ${tenant.createdAt},
          0,
          0,
          0,
          0
        )
        ON CONFLICT (id) DO NOTHING
      `;
      await sql`
        INSERT INTO api_keys (id, tenant_id, key_hash, label, key_prefix, created_at)
        VALUES (${key.id}, ${tenant.id}, ${key.keyHash}, ${key.label}, ${key.prefix}, ${key.createdAt})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }
  await sql`
    INSERT INTO operating_metrics (
      id, pii_entities_protected, estimated_savings_micros, overhead_total_ms, overhead_samples, cache_hits_today
    ) VALUES (1, 0, 0, 0, 0, 0)
    ON CONFLICT (id) DO NOTHING
  `;
}

export function createPostgresTenantRepository(databaseUrl: string): TenantRepository {
  const sql = postgresClient(databaseUrl);
  return {
    async findByKeyHash(keyHash): Promise<ResolvedCredential | null> {
      await prepareDatabase(databaseUrl);
      const rows = await sql`
        SELECT t.*, k.id AS api_key_id
        FROM api_keys k
        JOIN tenants t ON t.id = k.tenant_id
        WHERE k.key_hash = ${keyHash}
          AND k.revoked_at IS NULL
          AND t.archived_at IS NULL
        LIMIT 1
      `;
      const found = rows[0];
      if (!found) return null;
      return { tenant: tenantFrom(found), apiKeyId: String(found.api_key_id) };
    },
    async touchKey(keyId) {
      await prepareDatabase(databaseUrl);
      await sql`UPDATE api_keys SET last_used_at = now() WHERE id = ${keyId}`;
    },
    async get(tenantId) {
      await prepareDatabase(databaseUrl);
      const rows = await sql`SELECT * FROM tenants WHERE id = ${tenantId} LIMIT 1`;
      return rows[0] ? tenantFrom(rows[0]) : null;
    },
    async list() {
      await prepareDatabase(databaseUrl);
      const rows = await sql`SELECT * FROM tenants ORDER BY name`;
      return rows.map(tenantFrom);
    },
    async create(input) {
      await prepareDatabase(databaseUrl);
      const id = createId("ten");
      const createdAt = new Date().toISOString();
      const settings = withSettingsDefaults(input.settings);
      const rows = await sql`
        INSERT INTO tenants (
          id, name, sector, privacy_mode, settings, created_at,
          spend_micros, requests_today, month_requests, month_cache_hits
        ) VALUES (
          ${id}, ${input.name}, ${input.sector}, ${"strict"}, ${JSON.stringify(settings)}::jsonb, ${createdAt}, 0, 0, 0, 0
        )
        RETURNING *
      `;
      return tenantFrom(row(rows));
    },
    async archive(tenantId) {
      await prepareDatabase(databaseUrl);
      const rows = await sql`
        UPDATE tenants SET archived_at = now() WHERE id = ${tenantId} AND archived_at IS NULL RETURNING *
      `;
      return rows[0] ? tenantFrom(rows[0]) : null;
    },
    async updateSettings(tenantId, settings) {
      await prepareDatabase(databaseUrl);
      const rows = await sql`
        UPDATE tenants
        SET settings = ${JSON.stringify(withSettingsDefaults({ ...settings, semanticCacheEnabled: false }))}::jsonb
        WHERE id = ${tenantId} AND archived_at IS NULL
        RETURNING *
      `;
      return rows[0] ? tenantFrom(rows[0]) : null;
    },
    async listKeys(tenantId) {
      await prepareDatabase(databaseUrl);
      const rows = await sql`
        SELECT * FROM api_keys WHERE tenant_id = ${tenantId} ORDER BY created_at DESC
      `;
      return rows.map(keyFrom);
    },
    async createKey(tenantId, name) {
      await prepareDatabase(databaseUrl);
      const tenantRows = await sql`SELECT id FROM tenants WHERE id = ${tenantId} AND archived_at IS NULL`;
      if (!tenantRows[0]) return null;
      const rawKey = `vk_${randomBytes(18).toString("hex")}`;
      const id = createId("key");
      const createdAt = new Date().toISOString();
      const prefix = rawKey.slice(0, 12);
      const rows = await sql`
        INSERT INTO api_keys (id, tenant_id, key_hash, label, key_prefix, created_at)
        VALUES (${id}, ${tenantId}, ${sha256(rawKey)}, ${name}, ${prefix}, ${createdAt})
        RETURNING *
      `;
      return { record: keyFrom(row(rows)), rawKey };
    },
    async revokeKey(tenantId, keyId) {
      await prepareDatabase(databaseUrl);
      const rows = await sql`
        UPDATE api_keys
        SET revoked_at = now()
        WHERE id = ${keyId} AND tenant_id = ${tenantId} AND revoked_at IS NULL
        RETURNING *
      `;
      return rows[0] ? keyFrom(rows[0]) : null;
    },
    async recordRequest(tenantId) {
      await prepareDatabase(databaseUrl);
      const updated = await sql`
        UPDATE tenants
        SET requests_today = requests_today + 1,
            month_requests = month_requests + 1
        WHERE id = ${tenantId}
          AND requests_today < (settings->>'dailyRequestLimit')::int
        RETURNING spend_micros
      `;
      if (updated[0]) return { allowed: true, spendMicros: num(updated[0].spend_micros) };
      const current = await sql`SELECT spend_micros FROM tenants WHERE id = ${tenantId}`;
      return { allowed: false, spendMicros: current[0] ? num(current[0].spend_micros) : 0 };
    },
    async addSpend(tenantId, actualMicros) {
      await prepareDatabase(databaseUrl);
      await sql`
        UPDATE tenants
        SET spend_micros = spend_micros + ${actualMicros}
        WHERE id = ${tenantId}
      `;
    },
    async recordCacheHit(tenantId) {
      await prepareDatabase(databaseUrl);
      await sql`
        UPDATE tenants
        SET month_cache_hits = month_cache_hits + 1
        WHERE id = ${tenantId}
      `;
    },
    async stats(tenantId) {
      await prepareDatabase(databaseUrl);
      const rows = await sql`
        SELECT spend_micros, requests_today, month_requests, month_cache_hits
        FROM tenants
        WHERE id = ${tenantId}
      `;
      const found = rows[0];
      if (!found) return null;
      return {
        spendMicros: num(found.spend_micros),
        requestsToday: num(found.requests_today),
        monthRequests: num(found.month_requests),
        monthCacheHits: num(found.month_cache_hits),
      };
    },
  };
}

export function createPostgresRequestRepository(databaseUrl: string): RequestRepository {
  const sql = postgresClient(databaseUrl);
  return {
    async insert(record) {
      await prepareDatabase(databaseUrl);
      await insertRequest(sql, record);
    },
    async get(tenantId, requestId) {
      await prepareDatabase(databaseUrl);
      const rows = await sql`
        SELECT * FROM gateway_requests
        WHERE tenant_id = ${tenantId} AND id = ${requestId}
        LIMIT 1
      `;
      return rows[0] ? requestFrom(rows[0]) : null;
    },
    async list(tenantId) {
      await prepareDatabase(databaseUrl);
      const rows = await sql`
        SELECT * FROM gateway_requests
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
      `;
      return rows.map(requestFrom);
    },
    async listAll() {
      await prepareDatabase(databaseUrl);
      const rows = await sql`SELECT * FROM gateway_requests ORDER BY created_at DESC`;
      return rows.map(requestFrom);
    },
  };
}

export function createPostgresLedgerRepository(databaseUrl: string): LedgerRepository {
  const sql = postgresClient(databaseUrl);
  return {
    async insert(entry) {
      await prepareDatabase(databaseUrl);
      await insertLedger(sql, entry);
    },
    async list(tenantId) {
      await prepareDatabase(databaseUrl);
      const rows = await sql`
        SELECT * FROM savings_ledger
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
      `;
      return rows.map(ledgerFrom);
    },
    async listAll() {
      await prepareDatabase(databaseUrl);
      const rows = await sql`SELECT * FROM savings_ledger ORDER BY created_at DESC`;
      return rows.map(ledgerFrom);
    },
    async spendSince(tenantId, sinceIso) {
      await prepareDatabase(databaseUrl);
      const rows = await sql`
        SELECT COALESCE(SUM(actual_micros), 0) AS spend
        FROM savings_ledger
        WHERE tenant_id = ${tenantId} AND created_at >= ${sinceIso}
      `;
      return num(row(rows).spend);
    },
  };
}

export function createPostgresAuditRepository(databaseUrl: string): AuditRepository {
  const sql = postgresClient(databaseUrl);
  return {
    async insert(event) {
      await prepareDatabase(databaseUrl);
      await sql`
        INSERT INTO audit_events (
          id, tenant_id, request_id, created_at, event, provider, model,
          latency_ms, cache_status, pii_entity_count, saving_reason
        ) VALUES (
          ${event.id},
          ${event.tenantId},
          ${event.requestId},
          ${event.createdAt},
          ${event.event},
          ${event.provider ?? null},
          ${event.model ?? null},
          ${event.latencyMs ?? null},
          ${event.cacheStatus ?? null},
          ${event.piiEntityCount ?? null},
          ${event.savingReason ?? null}
        )
      `;
    },
    async list(tenantId) {
      await prepareDatabase(databaseUrl);
      const rows = await sql`
        SELECT * FROM audit_events
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
      `;
      return rows.map(auditFrom);
    },
  };
}

export function createPostgresMetrics(databaseUrl: string): OperatingMetricsStore {
  const sql = postgresClient(databaseUrl);
  return {
    async read() {
      await prepareDatabase(databaseUrl);
      const rows = await sql`SELECT * FROM operating_metrics WHERE id = 1`;
      return metricsFrom(row(rows));
    },
    async recordCacheHit() {
      await prepareDatabase(databaseUrl);
      await sql`UPDATE operating_metrics SET cache_hits_today = cache_hits_today + 1 WHERE id = 1`;
    },
    async recordCompletion(piiCount, savingMicros, overheadMs) {
      await prepareDatabase(databaseUrl);
      await sql`
        UPDATE operating_metrics
        SET pii_entities_protected = pii_entities_protected + ${piiCount},
            estimated_savings_micros = estimated_savings_micros + ${savingMicros},
            overhead_samples = overhead_samples + 1,
            overhead_total_ms = overhead_total_ms + ${overheadMs}
        WHERE id = 1
      `;
    },
    async recordOverhead(overheadMs) {
      await prepareDatabase(databaseUrl);
      await sql`
        UPDATE operating_metrics
        SET overhead_samples = overhead_samples + 1,
            overhead_total_ms = overhead_total_ms + ${overheadMs}
        WHERE id = 1
      `;
    },
  };
}

export async function pingDatabase(databaseUrl: string): Promise<boolean> {
  try {
    await prepareDatabase(databaseUrl);
    const rows = await postgresClient(databaseUrl)`SELECT 1 AS ok`;
    return num(row(rows).ok) === 1;
  } catch {
    return false;
  }
}

async function insertRequest(sql: Sql, record: GatewayRequestMetadata): Promise<void> {
  await sql`
    INSERT INTO gateway_requests (
      id, tenant_id, created_at, provider, model, cache_status, pii_entity_count, pii_types,
      input_tokens, output_tokens, baseline_micros, actual_micros, gateway_saving_micros,
      saving_reason, gateway_overhead_ms, provider_latency_ms, total_ms, blocked, block_code, trace
    ) VALUES (
      ${record.id},
      ${record.tenantId},
      ${record.createdAt},
      ${record.provider},
      ${record.model},
      ${record.cacheStatus},
      ${record.piiEntityCount},
      ${record.piiTypes},
      ${record.inputTokens},
      ${record.outputTokens},
      ${record.baselineMicros},
      ${record.actualMicros},
      ${record.gatewaySavingMicros},
      ${record.savingReason},
      ${record.gatewayOverheadMs},
      ${record.providerLatencyMs},
      ${record.totalMs},
      ${record.blocked},
      ${record.blockCode ?? null},
      ${JSON.stringify(record.trace)}::jsonb
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

async function insertLedger(sql: Sql, entry: SavingsEntry): Promise<void> {
  await sql`
    INSERT INTO savings_ledger (
      id, tenant_id, request_id, created_at, provider, model, input_tokens, output_tokens,
      pricing_version, baseline_micros, actual_micros, gateway_saving_micros,
      provider_native_discount_micros, saving_reason
    ) VALUES (
      ${entry.id},
      ${entry.tenantId},
      ${entry.requestId},
      ${entry.createdAt},
      ${entry.provider},
      ${entry.model},
      ${entry.inputTokens},
      ${entry.outputTokens},
      ${entry.pricingVersion},
      ${entry.baselineMicros},
      ${entry.actualMicros},
      ${entry.gatewaySavingMicros},
      ${entry.providerNativeDiscountMicros},
      ${entry.reason}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

function tenantFrom(input: Record<string, unknown>): Tenant {
  return {
    id: String(input.id),
    name: String(input.name),
    sector: String(input.sector),
    privacyMode: "strict",
    settings: withSettingsDefaults(asSettings(input.settings)),
    createdAt: iso(input.created_at),
    archivedAt: input.archived_at ? iso(input.archived_at) : undefined,
  };
}

function keyFrom(input: Record<string, unknown>): ApiKeyRecord {
  return {
    id: String(input.id),
    tenantId: String(input.tenant_id),
    keyHash: String(input.key_hash),
    label: String(input.label),
    prefix: String(input.key_prefix ?? ""),
    createdAt: iso(input.created_at),
    revokedAt: input.revoked_at ? iso(input.revoked_at) : undefined,
    lastUsedAt: input.last_used_at ? iso(input.last_used_at) : undefined,
  };
}

function requestFrom(input: Record<string, unknown>): GatewayRequestMetadata {
  return {
    id: String(input.id),
    tenantId: String(input.tenant_id),
    createdAt: iso(input.created_at),
    provider: input.provider as ProviderId,
    model: String(input.model),
    cacheStatus: input.cache_status as CacheStatus,
    piiEntityCount: num(input.pii_entity_count),
    piiTypes: asStringArray(input.pii_types) as PiiType[],
    inputTokens: num(input.input_tokens),
    outputTokens: num(input.output_tokens),
    baselineMicros: num(input.baseline_micros),
    actualMicros: num(input.actual_micros),
    gatewaySavingMicros: num(input.gateway_saving_micros),
    savingReason: input.saving_reason as SavingReason,
    gatewayOverheadMs: num(input.gateway_overhead_ms),
    providerLatencyMs: num(input.provider_latency_ms),
    totalMs: num(input.total_ms),
    blocked: Boolean(input.blocked),
    blockCode: input.block_code ? String(input.block_code) : undefined,
    trace: asObject(input.trace) as unknown as GatewayRequestMetadata["trace"],
  };
}

function ledgerFrom(input: Record<string, unknown>): SavingsEntry {
  return {
    id: String(input.id),
    tenantId: String(input.tenant_id),
    requestId: String(input.request_id),
    createdAt: iso(input.created_at),
    provider: input.provider as ProviderId,
    model: String(input.model),
    inputTokens: num(input.input_tokens),
    outputTokens: num(input.output_tokens),
    pricingVersion: String(input.pricing_version),
    baselineMicros: num(input.baseline_micros),
    actualMicros: num(input.actual_micros),
    gatewaySavingMicros: num(input.gateway_saving_micros),
    providerNativeDiscountMicros: num(input.provider_native_discount_micros),
    reason: input.saving_reason as SavingReason,
  };
}

function auditFrom(input: Record<string, unknown>): AuditEvent {
  return {
    id: String(input.id),
    tenantId: String(input.tenant_id),
    requestId: String(input.request_id),
    createdAt: iso(input.created_at),
    event: String(input.event),
    provider: optionalString(input.provider) as ProviderId | undefined,
    model: optionalString(input.model),
    latencyMs: input.latency_ms == null ? undefined : num(input.latency_ms),
    cacheStatus: optionalString(input.cache_status) as CacheStatus | undefined,
    piiEntityCount: input.pii_entity_count == null ? undefined : num(input.pii_entity_count),
    savingReason: optionalString(input.saving_reason) as SavingReason | undefined,
  };
}

function metricsFrom(input: Record<string, unknown>): OperatingMetrics {
  return {
    piiEntitiesProtected: num(input.pii_entities_protected),
    estimatedSavingsMicros: num(input.estimated_savings_micros),
    overheadTotalMs: num(input.overhead_total_ms),
    overheadSamples: num(input.overhead_samples),
    cacheHitsToday: num(input.cache_hits_today),
  };
}

function asSettings(value: unknown): TenantSettings {
  return asObject(value) as unknown as TenantSettings;
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    const trimmed = value.replace(/^\{|\}$/g, "");
    return trimmed.length === 0 ? [] : trimmed.split(",");
  }
  return [];
}

function optionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  return String(value);
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function row(rows: Record<string, unknown>[]): Record<string, unknown> {
  return rows[0] ?? {};
}
