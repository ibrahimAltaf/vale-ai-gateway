import { z } from "zod";

import { MODELS } from "@/data/catalogue";
import { PROVIDERS } from "@/types/domain";

export const completionSchema = z.object({
  provider: z.enum(PROVIDERS),
  model: z.string().min(1).max(80),
  prompt: z.string().min(1).max(8000),
  batchEligible: z.boolean().default(false),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().min(16).max(4000).default(400),
});

export const inspectSchema = z.object({
  text: z.string().min(1).max(8000),
});

export const settingsSchema = z.object({
  monthlyBudgetMicros: z.number().int().min(0).max(1_000_000_000_000),
  dailyRequestLimit: z.number().int().min(1).max(1_000_000),
  perRequestMaxMicros: z.number().int().min(0).max(1_000_000_000_000).default(100_000_000),
  fallbackPolicy: z.enum(["fail_closed", "fail_open"]),
  semanticCacheEnabled: z.boolean(),
  exactCacheEnabled: z.boolean(),
  batchEligibilityDefault: z.boolean(),
  preferredProviders: z.array(z.enum(PROVIDERS)).min(1),
  enabledModels: z.array(z.string().min(1).max(80)).default([]),
  fallbackModel: z.string().min(1).max(80),
  spikeAlertThresholdMicros: z.number().int().min(0).max(1_000_000_000_000),
  cacheTtlSeconds: z.number().int().min(60).max(2_592_000).default(86_400),
  slug: z
    .string()
    .max(80)
    .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and hyphens.")
    .default(""),
  description: z.string().max(280).default(""),
  environment: z.enum(["development", "staging", "production"]).default("development"),
});

export const healthSchema = z.object({
  piiAvailable: z.boolean(),
});

export function modelMatchesProvider(provider: string, model: string): boolean {
  return MODELS.some((item) => item.provider === provider && item.id === model);
}
