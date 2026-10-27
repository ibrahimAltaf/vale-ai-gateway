import { z } from "zod";

import { errorResponse, requestIdFrom } from "@/server/api/http";
import { assertDemoConsole } from "@/server/api/guard";
import { getContext } from "@/server/container";
import { withSettingsDefaults } from "@/server/domain/settings";
import { InvalidRequestError } from "@/server/domain/errors";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  sector: z.string().min(2).max(80).default("General"),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens."),
  description: z.string().max(280).default(""),
  environment: z.enum(["development", "staging", "production"]).default("development"),
  preferredProviders: z.array(z.enum(["openai", "anthropic", "google"])).min(1).default(["openai", "anthropic", "google"]),
  monthlyBudgetMicros: z.number().int().min(0).max(1_000_000_000_000).default(1_000_000_000),
  spikeAlertThresholdMicros: z.number().int().min(0).max(1_000_000_000_000).default(0),
  fallbackPolicy: z.enum(["fail_closed", "fail_open"]).default("fail_closed"),
  exactCacheEnabled: z.boolean().default(true),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await assertDemoConsole(context, requestId, request);
    const tenants = await context.tenants.list();
    const organisations = await Promise.all(
      tenants.map(async (tenant) => {
        const keys = await context.tenants.listKeys(tenant.id);
        return {
          id: tenant.id,
          name: tenant.name,
          sector: tenant.sector,
          archivedAt: tenant.archivedAt ?? null,
          slug: tenant.settings.slug,
          description: tenant.settings.description,
          environment: tenant.settings.environment,
          monthlyBudgetMicros: tenant.settings.monthlyBudgetMicros,
          exactCacheEnabled: tenant.settings.exactCacheEnabled,
          fallbackPolicy: tenant.settings.fallbackPolicy,
          keys: keys.map(publicKey),
        };
      }),
    );
    return Response.json({ ok: true, organisations });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = getContext();
    await assertDemoConsole(context, requestId, request);
    const body = createSchema.parse(await request.json());
    const existing = await context.tenants.list();
    if (existing.some((tenant) => tenant.name.toLowerCase() === body.name.toLowerCase())) {
      throw new InvalidRequestError(requestId, "An organisation with that name already exists.");
    }
    if (existing.some((tenant) => tenant.settings.slug === body.slug)) {
      throw new InvalidRequestError(requestId, "That slug is already in use.");
    }
    const tenant = await context.tenants.create({
      name: body.name,
      sector: body.sector,
      settings: withSettingsDefaults({
        monthlyBudgetMicros: body.monthlyBudgetMicros,
        dailyRequestLimit: 10_000,
        spikeAlertThresholdMicros: body.spikeAlertThresholdMicros,
        preferredProviders: body.preferredProviders,
        fallbackPolicy: body.fallbackPolicy,
        exactCacheEnabled: body.exactCacheEnabled,
        slug: body.slug,
        description: body.description,
        environment: body.environment,
      }),
    });
    return Response.json({
      ok: true,
      organisation: {
        id: tenant.id,
        name: tenant.name,
        sector: tenant.sector,
        slug: tenant.settings.slug,
        environment: tenant.settings.environment,
      },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

function publicKey(key: { id: string; label: string; prefix: string; createdAt: string; revokedAt?: string; lastUsedAt?: string }) {
  return {
    id: key.id,
    name: key.label,
    prefix: key.prefix,
    createdAt: key.createdAt,
    revokedAt: key.revokedAt ?? null,
    lastUsedAt: key.lastUsedAt ?? null,
  };
}
