import { findModel, MODELS } from "@/data/catalogue";
import type { GatewayRequestInput, ProviderId } from "@/types/domain";
import { PROVIDERS } from "@/types/domain";

export interface OpenAIChatRequest {
  input: GatewayRequestInput;
  stream: boolean;
}

export function parseOpenAIChat(body: unknown): OpenAIChatRequest | { error: string } {
  if (!body || typeof body !== "object") return { error: "A JSON body is required." };
  const record = body as Record<string, unknown>;
  const messages = Array.isArray(record.messages) ? record.messages : [];
  const user = [...messages].reverse().find((message) => {
    return message && typeof message === "object" && (message as { role?: string }).role === "user";
  }) as { content?: unknown } | undefined;
  const prompt = typeof user?.content === "string" ? user.content : "";
  if (!prompt.trim()) return { error: "messages must include a user message with string content." };
  const resolved = resolveModel(typeof record.model === "string" ? record.model : "");
  if ("error" in resolved) return resolved;
  const temperature = typeof record.temperature === "number" ? record.temperature : 0.2;
  const maxTokens = typeof record.max_tokens === "number" ? record.max_tokens : 400;
  if (temperature < 0 || temperature > 2) return { error: "temperature must be between 0 and 2." };
  if (!Number.isInteger(maxTokens) || maxTokens < 16 || maxTokens > 4000) {
    return { error: "max_tokens must be an integer from 16 to 4000." };
  }
  return {
    stream: record.stream === true,
    input: {
      provider: resolved.provider,
      model: resolved.model,
      prompt,
      batchEligible: false,
      temperature,
      maxTokens,
    },
  };
}

function resolveModel(value: string): { provider: ProviderId; model: string } | { error: string } {
  const [maybeProvider, maybeModel] = value.includes("/") ? value.split("/", 2) : ["", value];
  if (maybeProvider && (PROVIDERS as readonly string[]).includes(maybeProvider) && maybeModel && findModel(maybeProvider as ProviderId, maybeModel)) {
    return { provider: maybeProvider as ProviderId, model: maybeModel };
  }
  const matches = MODELS.filter((model) => model.id === value && model.enabled);
  if (matches.length === 1 && matches[0]) return { provider: matches[0].provider, model: matches[0].id };
  return { error: "model must be a catalogue id or provider/model, for example openai/gpt-4o-mini." };
}
