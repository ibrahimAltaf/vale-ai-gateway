import { describe, expect, it } from "vitest";

import { buildCacheKey } from "@/server/cache/key";
import type { CacheKeyContext } from "@/types/domain";

const SECRET = "test-cache-hmac-secret";

function context(overrides: Partial<CacheKeyContext> = {}): CacheKeyContext {
  return {
    tenantId: "ten_northstar",
    provider: "openai",
    model: "gpt-4o-mini",
    maskedPrompt: "summarise the record for <nhs_1>",
    sensitiveValues: ["NHS_NUMBER:9434765919"],
    temperature: 0.2,
    maxTokens: 400,
    batchEligible: false,
    ...overrides,
  };
}

describe("cache key", () => {
  it("is stable for the same request", () => {
    expect(buildCacheKey(context(), SECRET).key).toBe(buildCacheKey(context(), SECRET).key);
  });

  it("changes with tenant, model, settings and privacy context", () => {
    const base = buildCacheKey(context(), SECRET).key;
    expect(buildCacheKey(context({ tenantId: "ten_acme" }), SECRET).key).not.toBe(base);
    expect(buildCacheKey(context({ model: "gpt-4o" }), SECRET).key).not.toBe(base);
    expect(buildCacheKey(context({ temperature: 0.8 }), SECRET).key).not.toBe(base);
    expect(buildCacheKey(context({ sensitiveValues: ["NHS_NUMBER:4010232137"] }), SECRET).key).not.toBe(base);
  });

  it("never writes the raw NHS number into the key", () => {
    const key = buildCacheKey(context(), SECRET).key;
    expect(key).not.toContain("9434765919");
    expect(key).not.toContain("943 476 5919");
    expect(key.startsWith("cache:v1:ten_northstar:openai:gpt-4o-mini:")).toBe(true);
  });
});
