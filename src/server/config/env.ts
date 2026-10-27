import "server-only";

import { z } from "zod";

const optionalUrl = z.preprocess((value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value), z.string().min(1).optional());

const envSchema = z.object({
  DATABASE_URL: optionalUrl,
  REDIS_URL: optionalUrl,
  CACHE_HMAC_SECRET: z.string().min(16).optional(),
  LITELLM_BASE_URL: optionalUrl,
  LITELLM_API_KEY: optionalUrl,
  OPENAI_API_KEY: optionalUrl,
  ANTHROPIC_API_KEY: optionalUrl,
  GOOGLE_API_KEY: optionalUrl,
  DEMO_MODE: z.enum(["true", "false"]).optional(),
  SESSION_SECRET: z.string().min(24).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

export interface AppConfig {
  demoMode: boolean;
  databaseUrl?: string;
  redisUrl?: string;
  cacheHmacSecret: string;
  litellmBaseUrl?: string;
  litellmApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
  sessionSecret: string;
  adminEmail: string;
  adminPassword: string;
}

const DEMO_HMAC_SECRET = "demo-only-cache-hmac-secret";

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Environment configuration is invalid.");
  }
  const demoMode = parsed.data.DEMO_MODE === "true";
  const cacheHmacSecret = parsed.data.CACHE_HMAC_SECRET ?? (demoMode ? DEMO_HMAC_SECRET : undefined);
  if (!cacheHmacSecret) {
    throw new Error("CACHE_HMAC_SECRET is required when DEMO_MODE is false.");
  }
  const sessionSecret = parsed.data.SESSION_SECRET ?? "demo-only-session-secret-32chars";
  const adminPassword = parsed.data.ADMIN_PASSWORD ?? "vale-admin-change-me";
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    if (!parsed.data.SESSION_SECRET || parsed.data.SESSION_SECRET === "demo-only-session-secret-32chars") {
      throw new Error("SESSION_SECRET must be set to a unique value in production.");
    }
    if (!parsed.data.ADMIN_PASSWORD || parsed.data.ADMIN_PASSWORD === "vale-admin-change-me") {
      throw new Error("ADMIN_PASSWORD must be set to a unique value in production.");
    }
  }
  cached = {
    demoMode,
    databaseUrl: parsed.data.DATABASE_URL,
    redisUrl: parsed.data.REDIS_URL,
    cacheHmacSecret,
    sessionSecret,
    adminEmail: parsed.data.ADMIN_EMAIL ?? "admin@vale.local",
    adminPassword,
    litellmBaseUrl: emptyToUndefined(parsed.data.LITELLM_BASE_URL),
    litellmApiKey: emptyToUndefined(parsed.data.LITELLM_API_KEY),
    openaiApiKey: emptyToUndefined(parsed.data.OPENAI_API_KEY),
    anthropicApiKey: emptyToUndefined(parsed.data.ANTHROPIC_API_KEY),
    googleApiKey: emptyToUndefined(parsed.data.GOOGLE_API_KEY),
  };
  return cached;
}

export function resetConfigForTests(): void {
  cached = undefined;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value;
}
