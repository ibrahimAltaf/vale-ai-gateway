import type {
  CacheStatus,
  CostBreakdown,
  FallbackPolicy,
  HealthSnapshot,
  OverviewSnapshot,
  PiiType,
  PiiValidation,
  ProviderId,
  RequestTrace,
  SavingReason,
  SavingsEntry,
  TenantSummary,
} from "@/types/domain";

export interface ApiErrorBody {
  ok: false;
  code: string;
  message: string;
  requestId: string;
  providerContacted: false;
  sensitiveDataTransmitted: false;
}

export interface InspectedEntity {
  type: PiiType;
  value: string;
  start: number;
  end: number;
  token: string;
  validation?: PiiValidation;
}

export interface GatewaySuccessBody {
  ok: true;
  requestId: string;
  tenantId: string;
  tenantName: string;
  originalPrompt: string;
  entities: InspectedEntity[];
  maskedPrompt: string;
  providerResponse: string;
  restoredResponse: string;
  providerContacted: boolean;
  sensitiveDataTransmitted: false;
  privacyStatus: "protected";
  metrics: {
    provider: ProviderId;
    model: string;
    inputTokens: number;
    outputTokens: number;
    providerCostMicros: number;
    baselineMicros: number;
    savingMicros: number;
    savingReason: SavingReason;
    gatewayOverheadMs: number;
    cacheStatus: CacheStatus;
    piiEntitiesRemoved: number;
  };
  cost: CostBreakdown;
  trace: RequestTrace;
  cache: {
    display: string;
    privacyContextLabel: string;
    hit: boolean;
  };
}

export type GatewayResponseBody = GatewaySuccessBody | ApiErrorBody;

export interface PrivacyInspectBody {
  ok: true;
  masked: string;
  entities: InspectedEntity[];
  nhs: Array<{
    value: string;
    checksum: "Valid" | "Invalid";
    method: "Modulus 11";
    status: "Protected before provider";
  }>;
}

export interface CacheLabBody {
  ok: true;
  maskedTextIdentical: boolean;
  cacheKeysDifferent: boolean;
  leakage: "blocked";
  patients: Array<{
    label: string;
    organisation: string;
    nhs: string;
    prompt: string;
    masked: string;
    cacheDisplay: string;
    privacyContextLabel: string;
    includes: string[];
  }>;
}

export interface LedgerBody {
  ok: true;
  currency: "GBP";
  baselineMicros: number;
  actualMicros: number;
  savingsMicros: number;
  savingsRate: number;
  breakdown: Array<{ reason: Exclude<SavingReason, "none">; label: string; amountMicros: number }>;
  planned?: Array<{ reason: string; label: string; status: "planned" }>;
  exclusionNote: string;
  months: Array<{ month: string; savingsMicros: number }>;
  entries: Array<
    SavingsEntry & {
      organisation: string;
    }
  >;
}

export interface RequestsBody {
  ok: true;
  page: number;
  pageSize: number;
  total: number;
  requests: Array<{
    id: string;
    tenantId: string;
    organisation: string;
    createdAt: string;
    provider: ProviderId;
    model: string;
    cacheStatus: CacheStatus;
    piiEntityCount: number;
    totalMs: number;
    gatewayOverheadMs: number;
    providerLatencyMs: number;
    savingMicros: number;
    actualMicros: number;
    inputTokens: number;
    outputTokens: number;
    blocked: boolean;
    blockCode?: string;
  }>;
}

export interface RequestDetailBody {
  ok: true;
  organisation: string;
  trace: RequestTrace;
  provider: ProviderId;
  model: string;
  cacheStatus: CacheStatus;
  piiEntityCount: number;
  piiTypes: PiiType[];
  blocked: boolean;
  blockCode?: string;
  gatewayOverheadMs: number;
  providerLatencyMs: number;
  totalMs: number;
  savingReason: SavingReason;
  inputTokens: number;
  outputTokens: number;
  actualMicros: number;
  savingMicros: number;
}

export interface TenantsBody {
  ok: true;
  tenants: TenantSummary[];
}

export interface OverviewBody {
  ok: true;
  overview: OverviewSnapshot;
  charts: {
    months: Array<{ month: string; savingsMicros: number }>;
    activity: Array<{ month: string; requests: number; spendMicros: number; savingsMicros: number }>;
    breakdown: Array<{ label: string; amountMicros: number }>;
    planned: Array<{ label: string }>;
    tenants: Array<{ name: string; spendMicros: number; savingsMicros: number }>;
    providers: Array<{ name: string; count: number }>;
    models: Array<{ name: string; count: number }>;
    cache: Array<{ name: string; count: number }>;
  };
}

export interface HealthBody {
  ok: true;
  health: HealthSnapshot;
  policies: Array<{ tenantId: string; name: string; fallbackPolicy: FallbackPolicy }>;
}

export interface SettingsBody {
  ok: true;
  tenantId: string;
  name: string;
  settings: {
    monthlyBudgetMicros: number;
    dailyRequestLimit: number;
    perRequestMaxMicros: number;
    fallbackPolicy: FallbackPolicy;
    semanticCacheEnabled: boolean;
    exactCacheEnabled: boolean;
    batchEligibilityDefault: boolean;
    preferredProviders: ProviderId[];
    enabledModels: string[];
    fallbackModel: string;
    spikeAlertThresholdMicros: number;
    cacheTtlSeconds: number;
    slug: string;
    description: string;
    environment: "development" | "staging" | "production";
  };
}

export interface QualityReport {
  recordedAt: string;
  source: "local-verification";
  label: string;
  commands: Array<{ name: string; status: "pass" | "fail" | "not-recorded"; detail: string }>;
}
