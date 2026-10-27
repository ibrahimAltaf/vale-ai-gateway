import { parseOpenAIChat } from "@/server/api/openai-chat";
import { errorResponse, requestIdFrom } from "@/server/api/http";
import { resolveTenant } from "@/server/auth/resolve-tenant";
import { getContext } from "@/server/container";
import { InvalidRequestError } from "@/server/domain/errors";
import { providerConfigured } from "@/server/providers/status";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    const tenant = await resolveTenant(request, context.tenants, requestId);
    const parsed = parseOpenAIChat(await request.json());
    if ("error" in parsed) throw new InvalidRequestError(requestId, parsed.error);
    if (!providerConfigured(context.config, parsed.input.provider)) {
      throw new InvalidRequestError(requestId, `${parsed.input.provider} is not configured.`);
    }
    const outcome = await context.gateway.execute(tenant, parsed.input, requestId);
    if (outcome.type === "blocked") return errorResponse(outcome.error, requestId);
    const value = outcome.value;
    const completion = {
      id: value.requestId,
      object: "chat.completion",
      model: `${parsed.input.provider}/${parsed.input.model}`,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: value.restoredText },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: value.cost.inputTokens,
        completion_tokens: value.cost.outputTokens,
        total_tokens: value.cost.inputTokens + value.cost.outputTokens,
      },
      vale: {
        requestId: value.requestId,
        tenantId: value.tenant.id,
        cacheStatus: value.cacheStatus,
        providerContacted: value.providerContacted,
        sensitiveDataTransmitted: false,
        piiEntitiesRemoved: value.masked.entities.length,
        savingMicros: value.cost.gatewaySavingMicros,
        actualMicros: value.cost.actualMicros,
        gatewayOverheadMs: value.trace.gatewayOverheadMs,
      },
    };
    // Streaming is a post-restore lifecycle SSE feed, not token-by-token provider streaming.
    // The gateway must finish privacy restore before any completion text leaves the process.
    if (!parsed.stream) return Response.json(completion);
    const events = [
      { stage: "connecting" },
      { stage: "pii_protected", entities: value.masked.entities.length },
      value.providerContacted ? { stage: "provider_started" } : { stage: "cache_hit" },
      { stage: "completed", completion },
    ];
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
