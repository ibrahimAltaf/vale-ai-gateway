import { BATCH_PRICE_FACTOR, findModel, PRICING_VERSION, USD_TO_GBP } from "@/data/catalogue";
import type { ProviderId } from "@/types/domain";

export interface PricedModel {
  pricingVersion: string;
  provider: ProviderId;
  model: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  fxRate: number;
  batchFactor: number;
}

export class PricingService {
  resolve(provider: ProviderId, model: string): PricedModel | undefined {
    const spec = findModel(provider, model);
    if (!spec) return undefined;
    return {
      pricingVersion: PRICING_VERSION,
      provider,
      model,
      inputPerMillionUsd: spec.inputPerMillionUsd,
      outputPerMillionUsd: spec.outputPerMillionUsd,
      fxRate: USD_TO_GBP,
      batchFactor: BATCH_PRICE_FACTOR,
    };
  }
}

/** Integer millionths of a pound, so a single model call stays exact below one penny. */
export function tokenCostMicros(tokens: number, usdPerMillion: number, fxRate: number): number {
  const gbp = (tokens / 1_000_000) * usdPerMillion * fxRate;
  return Math.round(gbp * 1_000_000);
}
