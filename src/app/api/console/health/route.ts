import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { healthSchema } from "@/server/api/schemas";
import { getContext } from "@/server/container";
import { pingDatabase } from "@/server/repositories/postgres";
import { providerStatuses } from "@/server/providers/status";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await assertDemoConsole(context, requestId, request);
    const tenants = await context.tenants.list();
    const postgresLive = context.config.databaseUrl ? await pingDatabase(context.config.databaseUrl) : false;
    const redisLive = await context.cache.ping();
    const providers = await providerStatuses(context.config);
    const health = context.health.snapshot({
      postgresConfigured: Boolean(context.config.databaseUrl),
      postgresLive,
      redisConfigured: Boolean(context.config.redisUrl),
      redisLive,
      cacheMode: context.cacheMode,
    });
    health.components = health.components.map((component) => {
      const provider = providers.find((item) => item.id === component.id);
      if (!provider) return component;
      return { ...component, status: provider.status, detail: provider.detail };
    });
    return Response.json({
      ok: true,
      health,
      policies: tenants.map((tenant) => ({
        tenantId: tenant.id,
        name: tenant.name,
        fallbackPolicy: tenant.settings.fallbackPolicy,
      })),
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await assertDemoConsole(context, requestId, request);
    const body = healthSchema.parse(await request.json());
    context.health.setPiiAvailable(body.piiAvailable);
    const tenants = await context.tenants.list();
    const postgresLive = context.config.databaseUrl ? await pingDatabase(context.config.databaseUrl) : false;
    const redisLive = await context.cache.ping();
    const providers = await providerStatuses(context.config);
    const health = context.health.snapshot({
      postgresConfigured: Boolean(context.config.databaseUrl),
      postgresLive,
      redisConfigured: Boolean(context.config.redisUrl),
      redisLive,
      cacheMode: context.cacheMode,
    });
    health.components = health.components.map((component) => {
      const provider = providers.find((item) => item.id === component.id);
      if (!provider) return component;
      return { ...component, status: provider.status, detail: provider.detail };
    });
    return Response.json({
      ok: true,
      health,
      policies: tenants.map((tenant) => ({
        tenantId: tenant.id,
        name: tenant.name,
        fallbackPolicy: tenant.settings.fallbackPolicy,
      })),
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
