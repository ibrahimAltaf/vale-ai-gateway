import type { ProviderId, TenantSettings } from "@/types/domain";

export const DEFAULT_CACHE_TTL_SECONDS = 86_400;
export const DEFAULT_PER_REQUEST_MAX_MICROS = 100_000_000;

export function withSettingsDefaults(settings: Partial<TenantSettings> | undefined): TenantSettings {
  const preferredProviders = settings?.preferredProviders?.length
    ? settings.preferredProviders
    : (["openai", "anthropic", "google"] as ProviderId[]);
  return {
    monthlyBudgetMicros: settings?.monthlyBudgetMicros ?? 0,
    dailyRequestLimit: settings?.dailyRequestLimit ?? 1,
    perRequestMaxMicros: settings?.perRequestMaxMicros ?? DEFAULT_PER_REQUEST_MAX_MICROS,
    fallbackPolicy: settings?.fallbackPolicy ?? "fail_closed",
    semanticCacheEnabled: false,
    exactCacheEnabled: settings?.exactCacheEnabled ?? true,
    batchEligibilityDefault: settings?.batchEligibilityDefault ?? false,
    preferredProviders,
    enabledModels: settings?.enabledModels ?? [],
    fallbackModel: settings?.fallbackModel ?? "gpt-4o-mini",
    spikeAlertThresholdMicros: settings?.spikeAlertThresholdMicros ?? 0,
    cacheTtlSeconds: settings?.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS,
    slug: settings?.slug ?? "",
    description: settings?.description ?? "",
    environment: settings?.environment ?? "development",
  };
}
