import { errorResponse, requestIdFrom } from "@/server/api/http";
import { resolveTenant } from "@/server/auth/resolve-tenant";
import { getContext } from "@/server/container";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    const tenant = await resolveTenant(request, context.tenants, requestId);
    const [entries, requests, stats] = await Promise.all([
      context.ledger.list(tenant.id),
      context.requests.list(tenant.id),
      context.tenants.stats(tenant.id),
    ]);
    return Response.json({
      ok: true,
      tenantId: tenant.id,
      requests: requests.length,
      actualMicros: entries.reduce((total, entry) => total + entry.actualMicros, 0),
      baselineMicros: entries.reduce((total, entry) => total + entry.baselineMicros, 0),
      savingMicros: entries.reduce((total, entry) => total + entry.gatewaySavingMicros, 0),
      spendMicros: stats?.spendMicros ?? 0,
      monthlyBudgetMicros: tenant.settings.monthlyBudgetMicros,
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
