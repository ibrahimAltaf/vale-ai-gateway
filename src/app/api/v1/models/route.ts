import { errorResponse, requestIdFrom } from "@/server/api/http";
import { resolveTenant } from "@/server/auth/resolve-tenant";
import { getContext } from "@/server/container";
import { modelsFor, PROVIDER_LABELS } from "@/data/catalogue";
import { providerConfigured } from "@/server/providers/status";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    const tenant = await resolveTenant(request, context.tenants, requestId);
    const data = tenant.settings.preferredProviders.flatMap((provider) =>
      modelsFor(provider).map((model) => {
        const allowed = tenant.settings.enabledModels.length === 0 || tenant.settings.enabledModels.includes(model.id);
        const configured = providerConfigured(context.config, provider);
        return {
          id: `${provider}/${model.id}`,
          provider,
          model: model.id,
          label: model.label,
          providerLabel: PROVIDER_LABELS[provider],
          available: configured && allowed && model.enabled,
          configured,
          inputPerMillionUsd: model.inputPerMillionUsd,
          outputPerMillionUsd: model.outputPerMillionUsd,
          contextTokens: model.contextTokens,
          supportsStreaming: model.supportsStreaming,
          supportsBatch: model.supportsBatch,
        };
      }),
    );
    return Response.json({ object: "list", data });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
