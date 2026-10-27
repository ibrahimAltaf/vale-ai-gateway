import { tokenCostMicros, type PricedModel } from "@/server/cost/pricing";
import type { CacheStatus, CostBreakdown, SavingReason } from "@/types/domain";

export interface CostInput {
  priced: PricedModel;
  inputTokens: number;
  outputTokens: number;
  cacheStatus: CacheStatus;
  batchEligible: boolean;
  providerNativeDiscountMicros?: number;
}

export class CostCalculator {
  quote(input: CostInput): CostBreakdown {
    const interactive = interactiveCostMicros(input);
    const providerNativeDiscountMicros = input.providerNativeDiscountMicros ?? 0;

    if (input.cacheStatus === "hit") {
      return finish({
        priced: input.priced,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        baselineMicros: interactive,
        actualMicros: 0,
        reason: "exact_cache",
        providerNativeDiscountMicros,
      });
    }

    if (input.batchEligible) {
      const actual = Math.round(interactive * input.priced.batchFactor);
      return finish({
        priced: input.priced,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        baselineMicros: interactive,
        actualMicros: actual,
        reason: "batch",
        providerNativeDiscountMicros,
      });
    }

    return finish({
      priced: input.priced,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      baselineMicros: interactive,
      actualMicros: interactive,
      reason: "none",
      providerNativeDiscountMicros,
    });
  }
}

/**
 * Provider-native prompt-cache discounts are not gateway-created savings.
 * Subtract them from the gross difference so they cannot inflate the ledger.
 */
export function attributeGatewaySaving(input: {
  baselineMicros: number;
  actualMicros: number;
  providerNativeDiscountMicros: number;
}): number {
  const gross = input.baselineMicros - input.actualMicros;
  return Math.max(0, gross - input.providerNativeDiscountMicros);
}

function interactiveCostMicros(input: CostInput): number {
  return (
    tokenCostMicros(input.inputTokens, input.priced.inputPerMillionUsd, input.priced.fxRate) +
    tokenCostMicros(input.outputTokens, input.priced.outputPerMillionUsd, input.priced.fxRate)
  );
}

function finish(input: {
  priced: PricedModel;
  inputTokens: number;
  outputTokens: number;
  baselineMicros: number;
  actualMicros: number;
  reason: SavingReason;
  providerNativeDiscountMicros: number;
}): CostBreakdown {
  return {
    pricingVersion: input.priced.pricingVersion,
    currency: "GBP",
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    baselineMicros: input.baselineMicros,
    actualMicros: input.actualMicros,
    gatewaySavingMicros: attributeGatewaySaving(input),
    providerNativeDiscountMicros: input.providerNativeDiscountMicros,
    reason: input.reason,
  };
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
