import type { ProviderId } from "@/types/domain";

export interface ModelSpec {
  provider: ProviderId;
  id: string;
  label: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  contextTokens: number;
  supportsStreaming: boolean;
  supportsBatch: boolean;
  enabled: boolean;
}

export const PRICING_VERSION = "2026-04-01";
export const USD_TO_GBP = 0.78;
export const BATCH_PRICE_FACTOR = 0.5;

export const MODELS: ModelSpec[] = [
  { provider: "openai", id: "gpt-4o-mini", label: "GPT-4o mini", inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6, contextTokens: 128_000, supportsStreaming: true, supportsBatch: true, enabled: true },
  { provider: "openai", id: "gpt-4o", label: "GPT-4o", inputPerMillionUsd: 2.5, outputPerMillionUsd: 10, contextTokens: 128_000, supportsStreaming: true, supportsBatch: true, enabled: true },
  { provider: "anthropic", id: "claude-haiku-4.5", label: "Claude Haiku 4.5", inputPerMillionUsd: 1, outputPerMillionUsd: 5, contextTokens: 200_000, supportsStreaming: true, supportsBatch: true, enabled: true },
  { provider: "anthropic", id: "claude-sonnet-4.5", label: "Claude Sonnet 4.5", inputPerMillionUsd: 3, outputPerMillionUsd: 15, contextTokens: 200_000, supportsStreaming: true, supportsBatch: true, enabled: true },
  { provider: "google", id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", inputPerMillionUsd: 0.3, outputPerMillionUsd: 2.5, contextTokens: 1_000_000, supportsStreaming: true, supportsBatch: true, enabled: true },
  { provider: "google", id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", inputPerMillionUsd: 1.25, outputPerMillionUsd: 10, contextTokens: 1_000_000, supportsStreaming: true, supportsBatch: true, enabled: true },
];

export function modelsFor(provider: ProviderId): ModelSpec[] {
  return MODELS.filter((model) => model.provider === provider && model.enabled);
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

export function findModel(provider: ProviderId, modelId: string): ModelSpec | undefined {
  return MODELS.find((model) => model.provider === provider && model.id === modelId);
}

export const SAMPLE_PROMPT =
  "Please summarise the medical record for patient John Smith, NHS number 943 476 5919. His email is john.smith@example.com and postcode is SW1A 1AA.";

export interface PublicTenant {
  id: string;
  name: string;
  sector: string;
  apiKey: string;
}

export const PUBLIC_TENANTS: PublicTenant[] = [
  {
    id: "ten_northstar",
    name: "Northstar Health UK",
    sector: "Healthcare",
    apiKey: "vk_demo_northstar_7f3a9c",
  },
  {
    id: "ten_acme",
    name: "Acme Legal",
    sector: "Legal",
    apiKey: "vk_demo_acme_b21e44",
  },
  {
    id: "ten_finedge",
    name: "FinEdge UK",
    sector: "Financial services",
    apiKey: "vk_demo_finedge_91cd02",
  },
];
