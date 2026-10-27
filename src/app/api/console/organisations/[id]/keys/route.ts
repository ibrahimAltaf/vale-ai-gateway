import { z } from "zod";

import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { getContext } from "@/server/container";
import { createId } from "@/server/domain/ids";
import { InvalidRequestError } from "@/server/domain/errors";

const createSchema = z.object({
  name: z.string().min(2).max(60),
  regenerate: z.boolean().optional(),
  confirm: z.string().optional(),
  keyId: z.string().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const app = getContext();
    await assertDemoConsole(app, requestId, request);
    const { id } = await context.params;
    const body = createSchema.parse(await request.json());
    const tenant = await app.tenants.get(id);
    if (!tenant || tenant.archivedAt) throw new InvalidRequestError(requestId, "Choose an active organisation.");
    if (body.regenerate) {
      if (body.confirm !== "REGENERATE") throw new InvalidRequestError(requestId, "Type REGENERATE to confirm.");
      if (!body.keyId) throw new InvalidRequestError(requestId, "keyId is required to regenerate.");
      const revoked = await app.tenants.revokeKey(id, body.keyId);
      if (!revoked) throw new InvalidRequestError(requestId, "The previous key could not be revoked.");
    }
    const created = await app.tenants.createKey(id, body.name);
    if (!created) throw new InvalidRequestError(requestId, "The key could not be created.");
    await app.audits.insert({
      id: createId("aud"),
      requestId,
      tenantId: id,
      createdAt: new Date().toISOString(),
      event: "api_key.created",
    });
    return Response.json({
      ok: true,
      apiKey: { id: created.record.id, prefix: created.record.prefix, name: created.record.label, rawKey: created.rawKey },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const app = getContext();
    await assertDemoConsole(app, requestId, request);
    const { id } = await context.params;
    const keyId = new URL(request.url).searchParams.get("keyId");
    if (!keyId) throw new InvalidRequestError(requestId, "keyId is required.");
    const revoked = await app.tenants.revokeKey(id, keyId);
    if (!revoked) throw new InvalidRequestError(requestId, "The key could not be revoked.");
    await app.audits.insert({
      id: createId("aud"),
      requestId,
      tenantId: id,
      createdAt: new Date().toISOString(),
      event: "api_key.revoked",
    });
    return Response.json({ ok: true, prefix: revoked.prefix, revokedAt: revoked.revokedAt });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
