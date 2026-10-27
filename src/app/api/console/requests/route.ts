import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { getContext } from "@/server/container";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await assertDemoConsole(context, requestId, request);
    const tenants = await context.tenants.list();
    const names = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const provider = url.searchParams.get("provider") ?? "";
    const model = url.searchParams.get("model") ?? "";
    const cacheStatus = url.searchParams.get("cacheStatus") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = 20;
    const requests = (await context.requests.listAll()).filter((item) => {
      if (tenantId && item.tenantId !== tenantId) return false;
      if (provider && item.provider !== provider) return false;
      if (model && item.model !== model) return false;
      if (cacheStatus && item.cacheStatus !== cacheStatus) return false;
      if (status === "blocked" && !item.blocked) return false;
      if (status === "completed" && item.blocked) return false;
      if (from && item.createdAt < from) return false;
      if (to && item.createdAt > `${to}T23:59:59.999Z`) return false;
      return true;
    });
    const start = (page - 1) * pageSize;
    return Response.json({
      ok: true,
      page,
      pageSize,
      total: requests.length,
      requests: requests.slice(start, start + pageSize).map((item) => ({
        id: item.id,
        tenantId: item.tenantId,
        organisation: names.get(item.tenantId) ?? item.tenantId,
        createdAt: item.createdAt,
        provider: item.provider,
        model: item.model,
        cacheStatus: item.cacheStatus,
        piiEntityCount: item.piiEntityCount,
        totalMs: item.totalMs,
        gatewayOverheadMs: item.gatewayOverheadMs,
        providerLatencyMs: item.providerLatencyMs,
        savingMicros: item.gatewaySavingMicros,
        actualMicros: item.actualMicros,
        inputTokens: item.inputTokens,
        outputTokens: item.outputTokens,
        blocked: item.blocked,
        blockCode: item.blockCode,
      })),
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
