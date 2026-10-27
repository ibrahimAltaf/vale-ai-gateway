import { estimateTokens } from "@/server/cost/calculator";
import type { AIProvider, ProviderCompletionRequest, ProviderCompletionResult } from "@/server/providers/types";

export class DemoProvider implements AIProvider {
  readonly id = "demo" as const;

  constructor(private readonly delayMs: number) {}

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    const started = performance.now();
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    const tokens = request.maskedPrompt.match(/<[A-Z0-9_]+>/g) ?? [];
    const subject = tokens.length > 0 ? tokens.join(", ") : "the screened request";
    const text = [
      `Summary prepared for ${subject}.`,
      "The synthetic demonstration record shows a routine review with no acute escalation.",
      "Identifiers stayed inside the gateway and are restored only in the client response.",
      "No clinical decision should be taken from this simulated provider output.",
    ].join(" ");

    return {
      text,
      inputTokens: estimateTokens(request.maskedPrompt),
      outputTokens: estimateTokens(text),
      latencyMs: Math.round(performance.now() - started),
      provider: request.provider,
      model: request.model,
    };
  }

  async healthCheck() {
    return "operational" as const;
  }
}

export class FailingProvider implements AIProvider {
  readonly id = "demo" as const;

  async complete(): Promise<ProviderCompletionResult> {
    throw new Error("Provider adapter failed.");
  }

  async healthCheck() {
    return "unavailable" as const;
  }
}
