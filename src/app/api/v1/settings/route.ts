import { resolveTenant } from "@/server/auth/resolve-tenant";
import { errorResponse, requestIdFrom } from "@/server/api/http";
import { modelMatchesProvider, settingsSchema } from "@/server/api/schemas";
import { getContext } from "@/server/container";
import { InvalidRequestError } from "@/server/domain/errors";
import type { SettingsBody } from "@/types/api";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    const tenant = await resolveTenant(request, context.tenants, requestId);
    return Response.json(toBody(tenant.id, tenant.name, tenant.settings));
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PATCH(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    const tenant = await resolveTenant(request, context.tenants, requestId);
    const settings = settingsSchema.parse(await request.json());
    const fallbackProvider = settings.preferredProviders[0];
    if (!fallbackProvider || !modelMatchesProvider(fallbackProvider, settings.fallbackModel)) {
      const matchesAny = settings.preferredProviders.some((provider) =>
        modelMatchesProvider(provider, settings.fallbackModel),
      );
      if (!matchesAny) {
        throw new InvalidRequestError(requestId, "Choose a fallback model from a preferred provider.");
      }
    }
    const updated = await context.tenants.updateSettings(tenant.id, settings);
    if (!updated) throw new InvalidRequestError(requestId, "Organisation settings could not be saved.");
    return Response.json(toBody(updated.id, updated.name, updated.settings));
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

function toBody(
  tenantId: string,
  name: string,
  settings: SettingsBody["settings"],
): SettingsBody {
  return { ok: true, tenantId, name, settings };
}
