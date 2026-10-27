import { describe, expect, it } from "vitest";

import { sha256 } from "@/server/cache/key";
import { UnavailableCacheStore } from "@/server/cache/store";
import { createTestContext } from "@/server/container";
import { PUBLIC_TENANTS, SAMPLE_PROMPT } from "@/data/catalogue";
import { FailingProvider } from "@/server/providers/demo-provider";
import type { AIProvider, ProviderCompletionRequest, ProviderCompletionResult } from "@/server/providers/types";
import type { GatewayRequestInput, Tenant } from "@/types/domain";

const input: GatewayRequestInput = {
  provider: "openai",
  model: "gpt-4o-mini",
  prompt: SAMPLE_PROMPT,
  batchEligible: false,
  temperature: 0.2,
  maxTokens: 200,
};

class RecordingProvider implements AIProvider {
  readonly id = "demo" as const;
  calls: ProviderCompletionRequest[] = [];

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    this.calls.push(request);
    const text = `Summary for ${(request.maskedPrompt.match(/<[A-Z0-9_]+>/g) ?? []).join(", ")}.`;
    return {
      text,
      inputTokens: 40,
      outputTokens: 20,
      latencyMs: 5,
      provider: request.provider,
      model: request.model,
    };
  }

  async healthCheck() {
    return "operational" as const;
  }
}

async function tenant(context: ReturnType<typeof createTestContext>, apiKey: string): Promise<Tenant> {
  const resolved = await context.tenants.findByKeyHash(sha256(apiKey));
  if (!resolved) throw new Error("missing tenant");
  return resolved.tenant;
}

describe("gateway", () => {
  it("masks before the provider call and restores afterwards", async () => {
    const provider = new RecordingProvider();
    const context = createTestContext({ provider, delayMs: 0 });
    const northstar = await tenant(context, PUBLIC_TENANTS[0].apiKey);
    const outcome = await context.gateway.execute(northstar, input, "req_live_1");
    expect(outcome.type).toBe("completed");
    if (outcome.type !== "completed") return;
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.maskedPrompt).not.toContain("943 476 5919");
    expect(provider.calls[0]?.maskedPrompt).toContain("<NHS_1>");
    expect(outcome.value.restoredText).toContain("John Smith");
    expect(outcome.value.providerContacted).toBe(true);
    const logs = JSON.stringify(context.logger.readAll());
    expect(logs).not.toContain("943 476 5919");
    expect(logs).not.toContain("john.smith@example.com");
    expect(logs).not.toContain("SW1A 1AA");
    expect(logs).not.toContain("John Smith");
  });

  it("reuses an exact cache entry without a second provider call", async () => {
    const provider = new RecordingProvider();
    const context = createTestContext({ provider, delayMs: 0 });
    const northstar = await tenant(context, PUBLIC_TENANTS[0].apiKey);
    await context.gateway.execute(northstar, input, "req_cache_1");
    const second = await context.gateway.execute(northstar, input, "req_cache_2");
    expect(provider.calls).toHaveLength(1);
    expect(second.type).toBe("completed");
    if (second.type !== "completed") return;
    expect(second.value.cacheStatus).toBe("hit");
    expect(second.value.providerContacted).toBe(false);
    expect(second.value.cost.reason).toBe("exact_cache");
  });

  it("does not share cache entries across patients or tenants", async () => {
    const provider = new RecordingProvider();
    const context = createTestContext({ provider, delayMs: 0 });
    const northstar = await tenant(context, PUBLIC_TENANTS[0].apiKey);
    const acme = await tenant(context, PUBLIC_TENANTS[1].apiKey);
    await context.gateway.execute(northstar, { ...input, prompt: "Summarise the record for 943 476 5919" }, "req_a");
    await context.gateway.execute(northstar, { ...input, prompt: "Summarise the record for 401 023 2137" }, "req_b");
    await context.gateway.execute(acme, { ...input, prompt: "Summarise the record for 943 476 5919" }, "req_c");
    expect(provider.calls).toHaveLength(3);
    expect(await context.requests.get(acme.id, "req_a")).toBeNull();
    const acmeLedger = await context.ledger.list(acme.id);
    expect(acmeLedger.some((entry) => entry.requestId === "req_a")).toBe(false);
    expect(acmeLedger.some((entry) => entry.requestId === "req_c")).toBe(true);
  });

  it("rejects another organisation's API key", async () => {
    const context = createTestContext({ delayMs: 0 });
    const resolved = await context.tenants.findByKeyHash(sha256(PUBLIC_TENANTS[1].apiKey));
    expect(resolved?.tenant.id).toBe("ten_acme");
    expect(resolved?.tenant.id).not.toBe("ten_northstar");
  });

  it("fails closed when privacy protection is unavailable", async () => {
    const provider = new RecordingProvider();
    const context = createTestContext({ provider, delayMs: 0 });
    context.health.setPiiAvailable(false);
    const northstar = await tenant(context, PUBLIC_TENANTS[0].apiKey);
    const outcome = await context.gateway.execute(northstar, input, "req_blocked");
    expect(provider.calls).toHaveLength(0);
    expect(outcome.type).toBe("blocked");
    if (outcome.type !== "blocked") return;
    expect(outcome.error.code).toBe("PII_SERVICE_UNAVAILABLE");
  });

  it("blocks a request that would exceed budget", async () => {
    const provider = new RecordingProvider();
    const context = createTestContext({ provider, delayMs: 0 });
    const northstar = await tenant(context, PUBLIC_TENANTS[0].apiKey);
    await context.tenants.updateSettings(northstar.id, { ...northstar.settings, monthlyBudgetMicros: 0 });
    const updated = await context.tenants.get(northstar.id);
    if (!updated) throw new Error("missing");
    const outcome = await context.gateway.execute(updated, input, "req_budget");
    expect(provider.calls).toHaveLength(0);
    expect(outcome.type).toBe("blocked");
    if (outcome.type !== "blocked") return;
    expect(outcome.error.code).toBe("BUDGET_EXCEEDED");
  });

  it("does not forward a raw prompt when the provider fails", async () => {
    const context = createTestContext({ provider: new FailingProvider(), delayMs: 0 });
    const northstar = await tenant(context, PUBLIC_TENANTS[0].apiKey);
    const outcome = await context.gateway.execute(northstar, input, "req_provider");
    expect(outcome.type).toBe("blocked");
    if (outcome.type !== "blocked") return;
    expect(outcome.error.code).toBe("PROVIDER_UNAVAILABLE");
    expect(JSON.stringify(context.logger.readAll())).not.toContain(SAMPLE_PROMPT);
  });

  it("continues with a masked prompt when the cache store is down", async () => {
    const provider = new RecordingProvider();
    const context = createTestContext({ provider, cacheStore: new UnavailableCacheStore(), delayMs: 0 });
    const northstar = await tenant(context, PUBLIC_TENANTS[0].apiKey);
    const outcome = await context.gateway.execute(northstar, input, "req_cache_down");
    expect(outcome.type).toBe("completed");
    expect(provider.calls[0]?.maskedPrompt).toContain("<NHS_1>");
    expect(provider.calls[0]?.maskedPrompt).not.toContain("943 476 5919");
  });
});
