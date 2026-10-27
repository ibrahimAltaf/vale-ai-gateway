import { errorResponse, requestIdFrom } from "@/server/api/http";
import { getContext } from "@/server/container";
import { pingDatabase } from "@/server/repositories/postgres";
import { providerStatuses } from "@/server/providers/status";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    const postgresLive = context.config.databaseUrl ? await pingDatabase(context.config.databaseUrl) : false;
    const redisLive = await context.cache.ping();
    const providers = await providerStatuses(context.config);
    return Response.json({
      ok: postgresLive || !context.config.databaseUrl,
      demoMode: context.config.demoMode,
      privacy: context.health.isPiiAvailable() ? "healthy" : "unavailable",
      postgres: postgresLive ? "healthy" : context.config.databaseUrl ? "unavailable" : "memory",
      redis: context.cacheMode === "redis" ? (redisLive ? "healthy" : "unavailable") : "memory",
      providers: providers.map((provider) => ({
        id: provider.id,
        configured: provider.configured,
        status: provider.status,
      })),
      requestId,
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
