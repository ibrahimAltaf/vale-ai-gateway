import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { getContext } from "@/server/container";
import { InvalidRequestError } from "@/server/domain/errors";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const app = getContext();
    await assertDemoConsole(app, requestId, request);
    const { id } = await context.params;
    const records = await app.requests.listAll();
    const record = records.find((item) => item.id === id);
    if (!record) throw new InvalidRequestError(requestId, "Request trace not found.");
    const tenant = await app.tenants.get(record.tenantId);
    return Response.json({
      ok: true,
      organisation: tenant?.name ?? record.tenantId,
      trace: record.trace,
      provider: record.provider,
      model: record.model,
      cacheStatus: record.cacheStatus,
      piiEntityCount: record.piiEntityCount,
      piiTypes: record.piiTypes,
      blocked: record.blocked,
      blockCode: record.blockCode,
      gatewayOverheadMs: record.gatewayOverheadMs,
      providerLatencyMs: record.providerLatencyMs,
      totalMs: record.totalMs,
      savingReason: record.savingReason,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      actualMicros: record.actualMicros,
      savingMicros: record.gatewaySavingMicros,
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
