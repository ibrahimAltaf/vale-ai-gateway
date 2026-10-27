import type { AppConfig } from "@/server/config/env";
import { DemoProvider } from "@/server/providers/demo-provider";
import { AnthropicProvider, GoogleProvider, LiteLLMProvider, OpenAIProvider } from "@/server/providers/http-providers";
import type { AIProvider } from "@/server/providers/types";
import type { ProviderId } from "@/types/domain";

export class ProviderService {
  constructor(
    private readonly config: AppConfig,
    private readonly demo: AIProvider,
    private readonly adapters: Record<ProviderId, AIProvider>,
    private readonly litellm?: LiteLLMProvider,
  ) {}

  resolve(provider: ProviderId): AIProvider {
    if (this.config.demoMode) return this.demo;
    if (this.litellm && this.config.litellmBaseUrl) return this.litellm;
    return this.adapters[provider];
  }
}

export function createProviderService(config: AppConfig, delayMs: number): ProviderService {
  const litellm =
    config.litellmBaseUrl && !config.demoMode
      ? new LiteLLMProvider(config.litellmBaseUrl, config.litellmApiKey)
      : undefined;
  return new ProviderService(
    config,
    new DemoProvider(delayMs),
    {
      openai: new OpenAIProvider(config.openaiApiKey),
      anthropic: new AnthropicProvider(config.anthropicApiKey),
      google: new GoogleProvider(config.googleApiKey),
    },
    litellm,
  );
}
