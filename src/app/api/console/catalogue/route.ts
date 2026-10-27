import { MODELS, PROVIDER_LABELS } from "@/data/catalogue";
import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { getContext } from "@/server/container";
import { providerConfigured } from "@/server/providers/status";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await assertDemoConsole(context, requestId, request);
    const tenants = await context.tenants.list();
    return Response.json({
      ok: true,
      demoMode: context.config.demoMode,
      semanticCache: "planned",
      tenants: tenants
        .filter((tenant) => !tenant.archivedAt)
        .map((tenant) => ({ id: tenant.id, name: tenant.name, sector: tenant.sector })),
      providers: (Object.keys(PROVIDER_LABELS) as Array<keyof typeof PROVIDER_LABELS>).map((id) => ({
        id,
        label: PROVIDER_LABELS[id],
        configured: providerConfigured(context.config, id),
      })),
      models: MODELS.filter((model) => model.enabled).map((model) => ({
        provider: model.provider,
        id: model.id,
        label: model.label,
        available: providerConfigured(context.config, model.provider),
        contextTokens: model.contextTokens,
        supportsStreaming: model.supportsStreaming,
        supportsBatch: model.supportsBatch,
        inputPerMillionUsd: model.inputPerMillionUsd,
        outputPerMillionUsd: model.outputPerMillionUsd,
      })),
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
