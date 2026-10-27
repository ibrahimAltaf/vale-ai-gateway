import { z } from "zod";

import { settingsSchema } from "@/server/api/schemas";
import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { getContext } from "@/server/container";
import { InvalidRequestError } from "@/server/domain/errors";

const patchSchema = z.object({
  action: z.enum(["archive", "settings"]),
  confirm: z.string().optional(),
  settings: settingsSchema.optional(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const app = getContext();
    await assertDemoConsole(app, requestId, request);
    const { id } = await context.params;
    const tenant = await app.tenants.get(id);
    if (!tenant) throw new InvalidRequestError(requestId, "Organisation was not found.");
    const [keys, stats, requests, ledger] = await Promise.all([
      app.tenants.listKeys(tenant.id),
      app.tenants.stats(tenant.id),
      app.requests.list(tenant.id),
      app.ledger.list(tenant.id),
    ]);
    return Response.json({
      ok: true,
      tenantId: tenant.id,
      name: tenant.name,
      sector: tenant.sector,
      archivedAt: tenant.archivedAt ?? null,
      settings: tenant.settings,
      keys: keys.map((key) => ({
        id: key.id,
        name: key.label,
        prefix: key.prefix,
        createdAt: key.createdAt,
        revokedAt: key.revokedAt ?? null,
        lastUsedAt: key.lastUsedAt ?? null,
      })),
      usage: {
        spendMicros: stats?.spendMicros ?? 0,
        savingsMicros: ledger.reduce((total, entry) => total + entry.gatewaySavingMicros, 0),
        requestsToday: stats?.requestsToday ?? 0,
        monthRequests: stats?.monthRequests ?? 0,
        monthCacheHits: stats?.monthCacheHits ?? 0,
      },
      recentRequests: requests.slice(0, 8).map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        provider: item.provider,
        model: item.model,
        cacheStatus: item.cacheStatus,
        blocked: item.blocked,
        totalMs: item.totalMs,
        actualMicros: item.actualMicros,
        savingMicros: item.gatewaySavingMicros,
      })),
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const app = getContext();
    await assertDemoConsole(app, requestId, request);
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    if (body.action === "archive") {
      if (body.confirm !== "ARCHIVE") throw new InvalidRequestError(requestId, "Type ARCHIVE to confirm.");
      const archived = await app.tenants.archive(id);
      if (!archived) throw new InvalidRequestError(requestId, "Organisation was not archived.");
      return Response.json({ ok: true, organisation: { id: archived.id, archivedAt: archived.archivedAt } });
    }
    if (!body.settings) throw new InvalidRequestError(requestId, "Settings are required.");
    const updated = await app.tenants.updateSettings(id, { ...body.settings, semanticCacheEnabled: false });
    if (!updated) throw new InvalidRequestError(requestId, "Organisation settings could not be saved.");
    return Response.json({ ok: true, settings: updated.settings });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
