import { resolveTenant } from "@/server/auth/resolve-tenant";
import { completionSchema, modelMatchesProvider } from "@/server/api/schemas";
import { errorResponse, requestIdFrom } from "@/server/api/http";
import { getContext } from "@/server/container";
import { InvalidRequestError } from "@/server/domain/errors";
import type { GatewaySuccessBody } from "@/types/api";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    const tenant = await resolveTenant(request, context.tenants, requestId);
    const body = completionSchema.parse(await request.json());
    if (!modelMatchesProvider(body.provider, body.model)) {
      throw new InvalidRequestError(requestId, "The model is not available for that provider.");
    }
    const outcome = await context.gateway.execute(tenant, body, requestId);
    if (outcome.type === "blocked") {
      return errorResponse(outcome.error, requestId);
    }
    const value = outcome.value;
    const response: GatewaySuccessBody = {
      ok: true,
      requestId: value.requestId,
      tenantId: value.tenant.id,
      tenantName: value.tenant.name,
      originalPrompt: value.masked.original,
      entities: value.masked.entities,
      maskedPrompt: value.masked.masked,
      providerResponse: value.providerText,
      restoredResponse: value.restoredText,
      providerContacted: value.providerContacted,
      sensitiveDataTransmitted: false,
      privacyStatus: "protected",
      metrics: {
        provider: body.provider,
        model: body.model,
        inputTokens: value.cost.inputTokens,
        outputTokens: value.cost.outputTokens,
        providerCostMicros: value.cost.actualMicros,
        baselineMicros: value.cost.baselineMicros,
        savingMicros: value.cost.gatewaySavingMicros,
        savingReason: value.cost.reason,
        gatewayOverheadMs: value.trace.gatewayOverheadMs,
        cacheStatus: value.cacheStatus,
        piiEntitiesRemoved: value.masked.entities.length,
      },
      cost: value.cost,
      trace: value.trace,
      cache: {
        display: value.cacheDisplay,
        privacyContextLabel: value.privacyContextLabel,
        hit: value.cacheStatus === "hit",
      },
    };
    return Response.json(response);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
