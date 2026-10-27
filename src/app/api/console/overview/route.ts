import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { getContext } from "@/server/container";
import { activityByMonth, readOverview } from "@/server/services/overview";
import type { GatewayRequestMetadata } from "@/types/domain";

function countBy(requests: GatewayRequestMetadata[], pick: (request: GatewayRequestMetadata) => string) {
  const buckets = new Map<string, number>();
  for (const request of requests) {
    const key = pick(request);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([name, count]) => ({ name, count }));
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await assertDemoConsole(context, requestId, request);
    const [overview, summary, tenants, requests] = await Promise.all([
      readOverview(context),
      context.savings.summarise(),
      context.savings.tenantSummaries(),
      context.requests.listAll(),
    ]);
    return Response.json({
      ok: true,
      overview,
      charts: {
        months: summary.months,
        activity: activityByMonth(requests, summary.entries),
        breakdown: summary.breakdown.map((item) => ({ label: item.label, amountMicros: item.amountMicros })),
        planned: summary.planned.map((item) => ({ label: item.label })),
        tenants: tenants.map((tenant) => ({
          name: tenant.name,
          spendMicros: tenant.currentSpendMicros,
          savingsMicros: tenant.savingsMicros,
        })),
        providers: countBy(requests, (item) => item.provider),
        models: countBy(requests, (item) => item.model),
        cache: countBy(requests, (item) => item.cacheStatus),
      },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
