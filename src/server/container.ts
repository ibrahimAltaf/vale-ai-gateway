import "server-only";

import { getConfig, type AppConfig } from "@/server/config/env";
import { CacheService } from "@/server/cache/cache-service";
import { RedisCacheStore } from "@/server/cache/redis-store";
import { MemoryCacheStore, type CacheStore } from "@/server/cache/store";
import { CostCalculator } from "@/server/cost/calculator";
import { PricingService } from "@/server/cost/pricing";
import { GatewayService } from "@/server/gateway/gateway-service";
import { HealthService } from "@/server/health/health-service";
import { SavingsLedgerService } from "@/server/ledger/savings-service";
import { AuditService } from "@/server/observability/audit-service";
import { MemoryLogger, type Logger } from "@/server/observability/logger";
import { PrivacyService, RegexPiiDetector } from "@/server/privacy/privacy-service";
import { createProviderService, ProviderService } from "@/server/providers/router";
import type { AIProvider } from "@/server/providers/types";
import {
  createAuditRepository,
  createLedgerRepository,
  createMemoryDatabase,
  createMemoryMetrics,
  createRequestRepository,
  createTenantRepository,
} from "@/server/repositories/memory";
import {
  createPostgresAuditRepository,
  createPostgresLedgerRepository,
  createPostgresMetrics,
  createPostgresRequestRepository,
  createPostgresTenantRepository,
} from "@/server/repositories/postgres";
import type {
  AuditRepository,
  LedgerRepository,
  OperatingMetricsStore,
  RequestRepository,
  TenantRepository,
} from "@/server/repositories/contracts";

export interface AppContext {
  config: AppConfig;
  usingPostgres: boolean;
  metrics: OperatingMetricsStore;
  tenants: TenantRepository;
  requests: RequestRepository;
  ledger: LedgerRepository;
  audits: AuditRepository;
  logger: Logger;
  health: HealthService;
  gateway: GatewayService;
  savings: SavingsLedgerService;
  privacy: PrivacyService;
  cache: CacheService;
  cacheMode: "redis" | "memory";
  providers: ProviderService;
}

export interface ContextOverrides {
  config?: AppConfig;
  delayMs?: number;
  cacheStore?: CacheStore;
  providerService?: ProviderService;
  logger?: Logger;
}

export function createContext(overrides: ContextOverrides = {}): AppContext {
  const config = overrides.config ?? getConfig();
  const databaseUrl = config.databaseUrl;
  const memory = databaseUrl ? undefined : createMemoryDatabase();
  const tenants = databaseUrl ? createPostgresTenantRepository(databaseUrl) : createTenantRepository(memory!);
  const requests = databaseUrl ? createPostgresRequestRepository(databaseUrl) : createRequestRepository(memory!);
  const ledgerRepo = databaseUrl ? createPostgresLedgerRepository(databaseUrl) : createLedgerRepository(memory!);
  const audits = databaseUrl ? createPostgresAuditRepository(databaseUrl) : createAuditRepository(memory!);
  const metrics = databaseUrl ? createPostgresMetrics(databaseUrl) : createMemoryMetrics(memory!);
  const cacheMode = config.redisUrl && !overrides.cacheStore ? "redis" : "memory";
  const cacheStore = overrides.cacheStore ?? (config.redisUrl ? new RedisCacheStore(config.redisUrl) : new MemoryCacheStore());
  const logger = overrides.logger ?? new MemoryLogger();
  const health = new HealthService();
  const privacy = new PrivacyService(new RegexPiiDetector());
  const cache = new CacheService(cacheStore, config.cacheHmacSecret);
  const providers = overrides.providerService ?? createProviderService(config, overrides.delayMs ?? (config.demoMode ? 720 : 0));
  const gateway = new GatewayService(
    tenants,
    requests,
    ledgerRepo,
    privacy,
    cache,
    providers,
    new PricingService(),
    new CostCalculator(),
    health,
    new AuditService(audits, logger),
    metrics,
  );

  return {
    config,
    usingPostgres: Boolean(databaseUrl),
    metrics,
    tenants,
    requests,
    ledger: ledgerRepo,
    audits,
    logger,
    health,
    gateway,
    savings: new SavingsLedgerService(ledgerRepo, tenants),
    privacy,
    cache,
    cacheMode,
    providers,
  };
}

declare global {
  var __valeContext: AppContext | undefined;
}

export function getContext(): AppContext {
  globalThis.__valeContext ??= createContext();
  return globalThis.__valeContext;
}

export function createTestContext(input: { provider?: AIProvider; cacheStore?: CacheStore; delayMs?: number } = {}): AppContext {
  const config: AppConfig = {
    demoMode: true,
    cacheHmacSecret: "test-cache-hmac-secret",
    sessionSecret: "test-session-secret-32-characters",
    adminEmail: "admin@vale.local",
    adminPassword: "vale-admin-change-me",
  };
  const providerService = input.provider
    ? new ProviderService(config, input.provider, {
        openai: input.provider,
        anthropic: input.provider,
        google: input.provider,
      })
    : undefined;
  return createContext({
    config,
    delayMs: input.delayMs ?? 0,
    cacheStore: input.cacheStore,
    providerService,
    logger: new MemoryLogger(),
  });
}
