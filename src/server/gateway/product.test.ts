import { describe, expect, it } from "vitest";

import { PUBLIC_TENANTS } from "@/data/catalogue";
import { parseOpenAIChat } from "@/server/api/openai-chat";
import { sha256 } from "@/server/cache/key";
import { createTestContext } from "@/server/container";
import type { AIProvider, ProviderCompletionRequest, ProviderCompletionResult } from "@/server/providers/types";
import type { GatewayRequestInput } from "@/types/domain";

const input: GatewayRequestInput = {
  provider: "openai",
  model: "gpt-4o-mini",
  prompt: "Hello from the gateway.",
  batchEligible: false,
  temperature: 0.2,
  maxTokens: 64,
};

class CountingProvider implements AIProvider {
  readonly id = "demo" as const;
  calls = 0;
  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    this.calls += 1;
    return { text: `ok ${request.model}`, inputTokens: 8, outputTokens: 4, latencyMs: 1, provider: request.provider, model: request.model };
  }
  async healthCheck() {
    return "operational" as const;
  }
}

describe("product gateway", () => {
  it("resolves a tenant only from the API key hash", async () => {
    const context = createTestContext();
    const resolved = await context.tenants.findByKeyHash(sha256(PUBLIC_TENANTS[0].apiKey));
    expect(resolved?.tenant.id).toBe("ten_northstar");
    expect(resolved?.tenant.id).not.toBe(PUBLIC_TENANTS[1].id);
  });

  it("rejects a revoked key and accepts a rotated key once", async () => {
    const context = createTestContext();
    const created = await context.tenants.createKey("ten_northstar", "Rotation");
    if (!created) throw new Error("missing key");
    await context.tenants.revokeKey("ten_northstar", created.record.id);
    expect(await context.tenants.findByKeyHash(sha256(created.rawKey))).toBeNull();
    const replacement = await context.tenants.createKey("ten_northstar", "Replacement");
    if (!replacement) throw new Error("missing replacement");
    expect((await context.tenants.findByKeyHash(sha256(replacement.rawKey)))?.tenant.id).toBe("ten_northstar");
    expect(replacement.rawKey).not.toBe(created.rawKey);
    const listed = await context.tenants.listKeys("ten_northstar");
    expect(listed.some((key) => key.keyHash === replacement.record.keyHash)).toBe(true);
    expect(JSON.stringify(listed)).not.toContain(replacement.rawKey);
  });

  it("persists settings and keeps semantic cache off", async () => {
    const context = createTestContext();
    const tenant = await context.tenants.get("ten_acme");
    if (!tenant) throw new Error("missing");
    const updated = await context.tenants.updateSettings("ten_acme", {
      ...tenant.settings,
      dailyRequestLimit: 12,
      semanticCacheEnabled: true,
    });
    expect(updated?.settings.dailyRequestLimit).toBe(12);
    expect(updated?.settings.semanticCacheEnabled).toBe(false);
  });

  it("blocks a per-request cost above the cap before calling the provider", async () => {
    const provider = new CountingProvider();
    const context = createTestContext({ provider });
    const tenant = await context.tenants.get("ten_northstar");
    if (!tenant) throw new Error("missing");
    await context.tenants.updateSettings(tenant.id, { ...tenant.settings, perRequestMaxMicros: 1, monthlyBudgetMicros: 9_000_000_000 });
    const updated = await context.tenants.get(tenant.id);
    if (!updated) throw new Error("missing");
    const outcome = await context.gateway.execute(updated, { ...input, prompt: "x".repeat(4000), maxTokens: 4000 }, "req_cap");
    expect(provider.calls).toBe(0);
    expect(outcome.type).toBe("blocked");
  });

  it("blocks a five-minute spend spike", async () => {
    const provider = new CountingProvider();
    const context = createTestContext({ provider });
    const tenant = await context.tenants.get("ten_finedge");
    if (!tenant) throw new Error("missing");
    await context.ledger.insert({
      id: "led_spike",
      tenantId: tenant.id,
      requestId: "req_old",
      createdAt: new Date().toISOString(),
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 10,
      outputTokens: 10,
      pricingVersion: "2026-04-01",
      baselineMicros: 5_000,
      actualMicros: 5_000,
      gatewaySavingMicros: 0,
      providerNativeDiscountMicros: 0,
      reason: "none",
    });
    await context.tenants.updateSettings(tenant.id, { ...tenant.settings, spikeAlertThresholdMicros: 1, monthlyBudgetMicros: 9_000_000_000 });
    const updated = await context.tenants.get(tenant.id);
    if (!updated) throw new Error("missing");
    const outcome = await context.gateway.execute(updated, input, "req_spike");
    expect(provider.calls).toBe(0);
    expect(outcome.type).toBe("blocked");
    if (outcome.type === "blocked") expect(outcome.error.code).toBe("SPIKE_DETECTED");
  });

  it("parses an OpenAI-compatible chat body and rejects an unknown model", () => {
    const parsed = parseOpenAIChat({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 32,
    });
    expect("input" in parsed).toBe(true);
    const invalid = parseOpenAIChat({ model: "missing-model", messages: [{ role: "user", content: "Hello" }] });
    expect(invalid).toEqual({ error: "model must be a catalogue id or provider/model, for example openai/gpt-4o-mini." });
  });

  it("keeps another organisation's requests invisible", async () => {
    const context = createTestContext({ provider: new CountingProvider() });
    const northstar = await context.tenants.get("ten_northstar");
    if (!northstar) throw new Error("missing");
    await context.gateway.execute(northstar, input, "req_iso");
    expect(await context.requests.get("ten_acme", "req_iso")).toBeNull();
    expect((await context.ledger.list("ten_acme")).some((entry) => entry.requestId === "req_iso")).toBe(false);
  });
});
