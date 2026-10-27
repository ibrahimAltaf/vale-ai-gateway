import { describe, expect, it } from "vitest";

import { attributeGatewaySaving, CostCalculator } from "@/server/cost/calculator";
import { PricingService } from "@/server/cost/pricing";
import { SEEDED_LEDGER } from "@/server/seed/ledger";

const pricing = new PricingService();
const calculator = new CostCalculator();

describe("cost and savings", () => {
  it("prices a known token volume in millionths of a pound", () => {
    const priced = pricing.resolve("openai", "gpt-4o");
    if (!priced) throw new Error("missing price");
    const quote = calculator.quote({
      priced,
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheStatus: "miss",
      batchEligible: false,
    });
    expect(quote.baselineMicros).toBe(Math.round(2.5 * 0.78 * 1_000_000));
    expect(quote.gatewaySavingMicros).toBe(0);
    expect(quote.reason).toBe("none");
  });

  it("attributes an exact cache hit entirely to the gateway", () => {
    const priced = pricing.resolve("openai", "gpt-4o-mini");
    if (!priced) throw new Error("missing price");
    const quote = calculator.quote({
      priced,
      inputTokens: 2000,
      outputTokens: 500,
      cacheStatus: "hit",
      batchEligible: true,
    });
    expect(quote.actualMicros).toBe(0);
    expect(quote.gatewaySavingMicros).toBe(quote.baselineMicros);
    expect(quote.reason).toBe("exact_cache");
  });

  it("prices batch as half the interactive baseline", () => {
    const priced = pricing.resolve("anthropic", "claude-sonnet-4.5");
    if (!priced) throw new Error("missing price");
    const quote = calculator.quote({
      priced,
      inputTokens: 1000,
      outputTokens: 1000,
      cacheStatus: "miss",
      batchEligible: true,
    });
    expect(quote.actualMicros).toBe(Math.round(quote.baselineMicros * 0.5));
    expect(quote.reason).toBe("batch");
  });

  it("excludes provider-native discounts from gateway savings", () => {
    expect(
      attributeGatewaySaving({
        baselineMicros: 100,
        actualMicros: 40,
        providerNativeDiscountMicros: 60,
      }),
    ).toBe(0);
  });

  it("keeps the seeded month ledger internally consistent", () => {
    const baseline = SEEDED_LEDGER.reduce((total, entry) => total + entry.baselineMicros, 0);
    const actual = SEEDED_LEDGER.reduce((total, entry) => total + entry.actualMicros, 0);
    const saving = SEEDED_LEDGER.reduce((total, entry) => total + entry.gatewaySavingMicros, 0);
    expect(baseline - actual).toBe(saving);
    expect(saving).toBe(1_302_640_000);
    expect(actual).toBe(2_914_160_000);
    const native = SEEDED_LEDGER.reduce((total, entry) => total + entry.providerNativeDiscountMicros, 0);
    expect(native).toBe(0);
  });
});
