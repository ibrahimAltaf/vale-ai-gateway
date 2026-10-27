export const PROVIDERS = ["openai", "anthropic", "google"] as const;

export type ProviderId = (typeof PROVIDERS)[number];

export type FallbackPolicy = "fail_closed" | "fail_open";

export type PrivacyMode = "strict";

export type ConsoleRole = "admin" | "org_admin" | "viewer";

export type CacheStatus = "hit" | "miss" | "unavailable" | "bypassed";

export type SavingReason =
  | "exact_cache"
  | "semantic_cache"
  | "model_routing"
  | "batch"
  | "none";

export type PiiType =
  | "NHS_NUMBER"
  | "NI_NUMBER"
  | "UK_POSTCODE"
  | "EMAIL"
  | "PHONE"
  | "PERSON"
  | "DATE_OF_BIRTH";

export interface PiiValidation {
  method: string;
  valid: boolean;
  detail: string;
}

export interface PiiEntity {
  type: PiiType;
  value: string;
  start: number;
  end: number;
  validation?: PiiValidation;
}

export interface Placeholder {
  token: string;
  type: PiiType;
  value: string;
}

export interface MaskedPrompt {
  original: string;
  masked: string;
  entities: Array<PiiEntity & { token: string }>;
  placeholders: Placeholder[];
}

export interface TenantSettings {
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
}

export interface Tenant {
  id: string;
  name: string;
  sector: string;
  privacyMode: PrivacyMode;
  settings: TenantSettings;
  createdAt: string;
  archivedAt?: string;
}

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  keyHash: string;
  label: string;
  prefix: string;
  createdAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
}

export interface GatewayRequestInput {
  provider: ProviderId;
  model: string;
  prompt: string;
  batchEligible: boolean;
  temperature: number;
  maxTokens: number;
}

export interface TraceStage {
  id: string;
  name: string;
  detail: string;
  offsetMs: number;
}

export interface RequestTrace {
  requestId: string;
  totalMs: number;
  gatewayOverheadMs: number;
  providerLatencyMs: number;
  stages: TraceStage[];
}

export interface ProviderUsage {
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  contacted: boolean;
}

export interface CostBreakdown {
  pricingVersion: string;
  currency: "GBP";
  inputTokens: number;
  outputTokens: number;
  baselineMicros: number;
  actualMicros: number;
  gatewaySavingMicros: number;
  providerNativeDiscountMicros: number;
  reason: SavingReason;
}

export interface SavingsEntry {
  id: string;
  tenantId: string;
  requestId: string;
  createdAt: string;
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  pricingVersion: string;
  baselineMicros: number;
  actualMicros: number;
  gatewaySavingMicros: number;
  providerNativeDiscountMicros: number;
  reason: SavingReason;
}

export interface AuditEvent {
  id: string;
  requestId: string;
  tenantId: string;
  createdAt: string;
  event: string;
  provider?: ProviderId;
  model?: string;
  latencyMs?: number;
  cacheStatus?: CacheStatus;
  piiEntityCount?: number;
  savingReason?: SavingReason;
}

export interface GatewayRequestMetadata {
  id: string;
  tenantId: string;
  createdAt: string;
  provider: ProviderId;
  model: string;
  cacheStatus: CacheStatus;
  piiEntityCount: number;
  piiTypes: PiiType[];
  inputTokens: number;
  outputTokens: number;
  baselineMicros: number;
  actualMicros: number;
  gatewaySavingMicros: number;
  savingReason: SavingReason;
  gatewayOverheadMs: number;
  providerLatencyMs: number;
  totalMs: number;
  blocked: boolean;
  blockCode?: string;
  trace: RequestTrace;
}

export interface CacheKeyParts {
  schemaVersion: "v1";
  tenantId: string;
  provider: ProviderId;
  model: string;
  maskedPromptHash: string;
  privacyContextHmac: string;
  settingsHash: string;
}

export interface CacheKeyResult {
  key: string;
  parts: CacheKeyParts;
  display: string;
  privacyContextLabel: string;
}

export interface CacheKeyContext {
  tenantId: string;
  provider: ProviderId;
  model: string;
  maskedPrompt: string;
  sensitiveValues: string[];
  temperature: number;
  maxTokens: number;
  batchEligible: boolean;
}

export interface CachedCompletion {
  maskedResponse: string;
  inputTokens: number;
  outputTokens: number;
  provider: ProviderId;
  model: string;
  storedAt: string;
}

export type ComponentStatus = "healthy" | "operational" | "unavailable" | "degraded" | "not_configured";

export interface HealthComponent {
  id: string;
  label: string;
  status: ComponentStatus;
  detail: string;
}

export interface HealthSnapshot {
  piiAvailable: boolean;
  components: HealthComponent[];
  checkedAt: string;
}

export interface OverviewSnapshot {
  requestsToday: number;
  requestsMonth: number;
  actualSpendMicros: number;
  cacheHitRate: number;
  piiEntitiesProtected: number;
  estimatedSavingsMicros: number;
  averageOverheadMs: number;
  activeOrganisations: number;
  gatewayOperational: boolean;
  piiProtectionActive: boolean;
  tenantIsolationActive: boolean;
  privacyBlocks: number;
}

export interface TenantSummary {
  id: string;
  name: string;
  sector: string;
  monthlyBudgetMicros: number;
  currentSpendMicros: number;
  savingsMicros: number;
  cacheHitRate: number;
  requests: number;
  privacyMode: PrivacyMode;
  fallbackPolicy: FallbackPolicy;
  exactCacheEnabled: boolean;
  semanticCacheEnabled: boolean;
}
