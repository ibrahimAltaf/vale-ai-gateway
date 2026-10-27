import { completionSchema, modelMatchesProvider } from "@/server/api/schemas";
import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { getContext } from "@/server/container";
import { InvalidRequestError } from "@/server/domain/errors";
import { providerConfigured } from "@/server/providers/status";
import type { GatewaySuccessBody } from "@/types/api";
import { z } from "zod";

const bodySchema = completionSchema.extend({ tenantId: z.string().min(1) });

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await assertDemoConsole(context, requestId, request);
    const body = bodySchema.parse(await request.json());
    if (!modelMatchesProvider(body.provider, body.model)) {
      throw new InvalidRequestError(requestId, "The model is not available for that provider.");
    }
    if (!providerConfigured(context.config, body.provider)) {
      throw new InvalidRequestError(requestId, `${body.provider} is not configured. Add a server-side API key or enable DEMO_MODE.`);
    }
    const tenant = await context.tenants.get(body.tenantId);
    if (!tenant || tenant.archivedAt) throw new InvalidRequestError(requestId, "Choose an active organisation.");
    const outcome = await context.gateway.execute(tenant, body, requestId);
    if (outcome.type === "blocked") return errorResponse(outcome.error, requestId);
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
