import { ProviderUnavailableError } from "@/server/domain/errors";
import type { AIProvider, ProviderCompletionRequest, ProviderCompletionResult } from "@/server/providers/types";
import type { ProviderId } from "@/types/domain";

interface ChatMessage {
  content?: string | Array<{ text?: string }>;
}

export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {}

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    return chatCompletions(this.baseUrl, this.apiKey, request, "openai");
  }

  async healthCheck() {
    return this.apiKey ? "operational" : "degraded";
  }
}

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic" as const;

  constructor(private readonly apiKey: string | undefined) {}

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    if (!this.apiKey) throw new ProviderUnavailableError("unscoped", "anthropic");
    const started = performance.now();
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        messages: [{ role: "user", content: request.maskedPrompt }],
      }),
    });
    if (!response.ok) throw new ProviderUnavailableError("unscoped", "anthropic");
    const body = (await response.json()) as {
      content?: Array<{ text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = body.content?.map((part) => part.text ?? "").join("") ?? "";
    return {
      text,
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
      latencyMs: Math.round(performance.now() - started),
      provider: request.provider,
      model: request.model,
    };
  }

  async healthCheck() {
    return this.apiKey ? "operational" : "degraded";
  }
}

export class GoogleProvider implements AIProvider {
  readonly id = "google" as const;

  constructor(private readonly apiKey: string | undefined) {}

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    if (!this.apiKey) throw new ProviderUnavailableError("unscoped", "google");
    const started = performance.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: request.maskedPrompt }] }],
        generationConfig: { temperature: request.temperature, maxOutputTokens: request.maxTokens },
      }),
    });
    if (!response.ok) throw new ProviderUnavailableError("unscoped", "google");
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    return {
      text,
      inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs: Math.round(performance.now() - started),
      provider: request.provider,
      model: request.model,
    };
  }

  async healthCheck() {
    return this.apiKey ? "operational" : "degraded";
  }
}

export class LiteLLMProvider implements AIProvider {
  readonly id = "litellm" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
  ) {}

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    return chatCompletions(this.baseUrl.replace(/\/$/, ""), this.apiKey, request, request.provider);
  }

  async healthCheck() {
    return this.apiKey ? "operational" : "degraded";
  }
}

async function chatCompletions(
  baseUrl: string,
  apiKey: string | undefined,
  request: ProviderCompletionRequest,
  providerLabel: ProviderId | string,
): Promise<ProviderCompletionResult> {
  if (!apiKey) throw new ProviderUnavailableError("unscoped", providerLabel);
  const started = performance.now();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      messages: [{ role: "user", content: request.maskedPrompt }],
    }),
  });
  if (!response.ok) throw new ProviderUnavailableError("unscoped", providerLabel);
  const body = (await response.json()) as {
    choices?: Array<{ message?: ChatMessage }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = body.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : content?.map((part) => part.text ?? "").join("") ?? "";
  return {
    text,
    inputTokens: body.usage?.prompt_tokens ?? 0,
    outputTokens: body.usage?.completion_tokens ?? 0,
    latencyMs: Math.round(performance.now() - started),
    provider: request.provider,
    model: request.model,
  };
}
