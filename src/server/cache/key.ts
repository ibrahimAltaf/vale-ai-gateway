import { createHash, createHmac } from "node:crypto";

import { canonicalJson, normalisePrompt } from "@/server/domain/canonical";
import type { CacheKeyContext, CacheKeyResult } from "@/types/domain";

export const CACHE_SCHEMA_VERSION = "v1" as const;

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/**
 * Include a privacy-context HMAC so two requests with identical masked text
 * but different sensitive entities cannot share a cached response.
 * Raw values are inputs to the HMAC only. They are not written into the key.
 */
export function buildCacheKey(context: CacheKeyContext, secret: string): CacheKeyResult {
  const maskedPromptHash = sha256(normalisePrompt(context.maskedPrompt));
  const privacyContextHmac = hmacSha256(
    secret,
    canonicalJson({
      tenantId: context.tenantId,
      values: [...context.sensitiveValues].sort(),
    }),
  );
  const settingsHash = sha256(
    canonicalJson({
      batchEligible: context.batchEligible,
      maxTokens: context.maxTokens,
      temperature: context.temperature,
    }),
  );

  const modelSegment = context.model.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = [
    "cache",
    CACHE_SCHEMA_VERSION,
    context.tenantId,
    context.provider,
    modelSegment,
    maskedPromptHash,
    privacyContextHmac,
    settingsHash,
  ].join(":");

  const privacyContextLabel = `ctx:${privacyContextHmac.slice(0, 4)}...${privacyContextHmac.slice(-4)}`;

  return {
    key,
    parts: {
      schemaVersion: CACHE_SCHEMA_VERSION,
      tenantId: context.tenantId,
      provider: context.provider,
      model: context.model,
      maskedPromptHash,
      privacyContextHmac,
      settingsHash,
    },
    privacyContextLabel,
    display: [
      `cache:${CACHE_SCHEMA_VERSION}`,
      context.tenantId,
      context.provider,
      modelSegment,
      `mp:${maskedPromptHash.slice(0, 12)}`,
      privacyContextLabel,
      `st:${settingsHash.slice(0, 8)}`,
    ].join(":"),
  };
}

export function assertTenantScopedKey(tenantId: string, key: string): void {
  const segments = key.split(":");
  if (segments[2] !== tenantId) {
    throw new Error("Cache key is outside the tenant namespace.");
  }
}
