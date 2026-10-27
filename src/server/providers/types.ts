import type { ProviderId } from "@/types/domain";

export interface ProviderCompletionRequest {
  provider: ProviderId;
  model: string;
  maskedPrompt: string;
  temperature: number;
  maxTokens: number;
}

export interface ProviderCompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  provider: ProviderId;
  model: string;
}

export interface AIProvider {
  readonly id: ProviderId | "demo" | "litellm";
  complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult>;
  healthCheck(): Promise<"operational" | "degraded" | "unavailable">;
}
