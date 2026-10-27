import { savingsByMonth } from "@/server/services/overview";
import type { LedgerRepository, TenantRepository } from "@/server/repositories/contracts";
import type { SavingsEntry, TenantSummary } from "@/types/domain";

const REASON_LABELS: Record<"exact_cache" | "batch", string> = {
  exact_cache: "Exact cache savings",
  batch: "Batch savings",
};

export class SavingsLedgerService {
  constructor(
    private readonly ledger: LedgerRepository,
    private readonly tenants: TenantRepository,
  ) {}

  async listAll(): Promise<SavingsEntry[]> {
    return this.ledger.listAll();
  }

  async summarise() {
    const entries = await this.ledger.listAll();
    const tenants = await this.tenants.list();
    const names = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
    const baselineMicros = sum(entries, "baselineMicros");
    const actualMicros = sum(entries, "actualMicros");
    const savingsMicros = sum(entries, "gatewaySavingMicros");
    const breakdown = (Object.keys(REASON_LABELS) as Array<keyof typeof REASON_LABELS>).map((reason) => ({
      reason,
      label: REASON_LABELS[reason],
      amountMicros: entries.filter((entry) => entry.reason === reason).reduce((total, entry) => total + entry.gatewaySavingMicros, 0),
    }));

    return {
      baselineMicros,
      actualMicros,
      savingsMicros,
      savingsRate: baselineMicros === 0 ? 0 : savingsMicros / baselineMicros,
      breakdown,
      planned: [
        { reason: "semantic_cache", label: "Planned semantic cache", status: "planned" as const },
        { reason: "model_routing", label: "Planned routing", status: "planned" as const },
      ],
      months: savingsByMonth(entries),
      entries: entries.map((entry) => ({
        ...entry,
        organisation: names.get(entry.tenantId) ?? entry.tenantId,
      })),
      exclusionNote: "Provider-native caching discounts are excluded from gateway-attributed savings.",
    };
  }

  async tenantSummaries(): Promise<TenantSummary[]> {
    const tenants = await this.tenants.list();
    const entries = await this.ledger.listAll();
    const summaries: TenantSummary[] = [];
    for (const tenant of tenants) {
      const stats = await this.tenants.stats(tenant.id);
      const own = entries.filter((entry) => entry.tenantId === tenant.id);
      const monthRequests = stats?.monthRequests ?? 0;
      const monthCacheHits = stats?.monthCacheHits ?? 0;
      summaries.push({
        id: tenant.id,
        name: tenant.name,
        sector: tenant.sector,
        monthlyBudgetMicros: tenant.settings.monthlyBudgetMicros,
        currentSpendMicros: sum(own, "actualMicros"),
        savingsMicros: sum(own, "gatewaySavingMicros"),
        cacheHitRate: monthRequests === 0 ? 0 : monthCacheHits / monthRequests,
        requests: monthRequests,
        privacyMode: tenant.privacyMode,
        fallbackPolicy: tenant.settings.fallbackPolicy,
        exactCacheEnabled: tenant.settings.exactCacheEnabled,
        semanticCacheEnabled: tenant.settings.semanticCacheEnabled,
      });
    }
    return summaries;
  }
}

function sum(entries: SavingsEntry[], key: "baselineMicros" | "actualMicros" | "gatewaySavingMicros"): number {
  return entries.reduce((total, entry) => total + entry[key], 0);
}
