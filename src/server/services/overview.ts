import type { AppContext } from "@/server/container";
import type { GatewayRequestMetadata, OverviewSnapshot, SavingsEntry } from "@/types/domain";

export async function readOverview(context: AppContext): Promise<OverviewSnapshot> {
  const [tenants, requests, ledger] = await Promise.all([
    context.tenants.list(),
    context.requests.listAll(),
    context.ledger.listAll(),
  ]);
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const today = requests.filter((request) => request.createdAt >= startOfDay && !request.blocked);
  const month = requests.filter((request) => request.createdAt >= startOfMonth);
  const hits = today.filter((request) => request.cacheStatus === "hit").length;
  const overheadSamples = requests.length;
  const overheadTotal = requests.reduce((total, request) => total + request.gatewayOverheadMs, 0);
  return {
    requestsToday: today.length,
    requestsMonth: month.length,
    actualSpendMicros: ledger.reduce((total, entry) => total + entry.actualMicros, 0),
    cacheHitRate: today.length === 0 ? 0 : hits / today.length,
    piiEntitiesProtected: requests.reduce((total, request) => total + request.piiEntityCount, 0),
    estimatedSavingsMicros: ledger.reduce((total, entry) => total + entry.gatewaySavingMicros, 0),
    averageOverheadMs: overheadSamples === 0 ? 0 : Math.round(overheadTotal / overheadSamples),
    activeOrganisations: tenants.filter((tenant) => !tenant.archivedAt).length,
    gatewayOperational: true,
    piiProtectionActive: context.health.isPiiAvailable(),
    tenantIsolationActive: true,
    privacyBlocks: requests.filter((request) => request.blocked).length,
  };
}

export function savingsByMonth(entries: SavingsEntry[]): Array<{ month: string; savingsMicros: number }> {
  return activityByMonth([], entries).map((item) => ({ month: item.month, savingsMicros: item.savingsMicros }));
}

export function activityByMonth(
  requests: GatewayRequestMetadata[],
  entries: SavingsEntry[],
): Array<{ month: string; requests: number; spendMicros: number; savingsMicros: number }> {
  const order: string[] = [];
  const buckets = new Map<string, { requests: number; spendMicros: number; savingsMicros: number }>();

  function bucket(iso: string) {
    const label = new Date(iso).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    const current = buckets.get(label);
    if (current) return current;
    const next = { requests: 0, spendMicros: 0, savingsMicros: 0 };
    buckets.set(label, next);
    order.push(label);
    return next;
  }

  for (const request of requests) bucket(request.createdAt).requests += 1;
  for (const entry of entries) {
    const row = bucket(entry.createdAt);
    row.spendMicros += entry.actualMicros;
    row.savingsMicros += entry.gatewaySavingMicros;
  }
  return order.map((month) => ({ month, ...buckets.get(month)! }));
}
