import type { AppConfig } from "@/server/config/env";
import type { ComponentStatus } from "@/types/domain";
import type { ProviderId } from "@/types/domain";

export interface ProviderStatus {
  id: ProviderId | "litellm";
  label: string;
  configured: boolean;
  status: ComponentStatus;
  detail: string;
}

export function providerConfigured(config: AppConfig, provider: ProviderId): boolean {
  if (config.demoMode) return true;
  if (config.litellmBaseUrl) return true;
  if (provider === "openai") return Boolean(config.openaiApiKey);
  if (provider === "anthropic") return Boolean(config.anthropicApiKey);
  return Boolean(config.googleApiKey);
}

export async function providerStatuses(config: AppConfig): Promise<ProviderStatus[]> {
  if (config.demoMode) {
    return [
      live("openai", "OpenAI", true, "operational", "Demo mode is answering. Live OpenAI credentials are not used."),
      live("anthropic", "Anthropic", true, "operational", "Demo mode is answering. Live Anthropic credentials are not used."),
      live("google", "Google", true, "operational", "Demo mode is answering. Live Google credentials are not used."),
    ];
  }
  const litellm = config.litellmBaseUrl
    ? await probe("LiteLLM", `${config.litellmBaseUrl.replace(/\/$/, "")}/v1/models`, config.litellmApiKey, "bearer")
    : undefined;
  return [
    litellm
      ? { id: "openai", label: "OpenAI", configured: true, status: litellm.status, detail: `Routed through LiteLLM. ${litellm.detail}` }
      : await direct("openai", "OpenAI", config.openaiApiKey, "https://api.openai.com/v1/models", "bearer"),
    litellm
      ? { id: "anthropic", label: "Anthropic", configured: true, status: litellm.status, detail: `Routed through LiteLLM. ${litellm.detail}` }
      : await direct("anthropic", "Anthropic", config.anthropicApiKey, "https://api.anthropic.com/v1/models", "anthropic"),
    litellm
      ? { id: "google", label: "Google", configured: true, status: litellm.status, detail: `Routed through LiteLLM. ${litellm.detail}` }
      : await direct("google", "Google", config.googleApiKey, "https://generativelanguage.googleapis.com/v1beta/models", "google"),
  ];
}

async function direct(
  id: ProviderId,
  label: string,
  apiKey: string | undefined,
  url: string,
  style: "bearer" | "anthropic" | "google",
): Promise<ProviderStatus> {
  if (!apiKey) return live(id, label, false, "not_configured", "Not configured. Add a server-side API key to send live model calls.");
  const target = style === "google" ? `${url}?key=${apiKey}&pageSize=1` : url;
  const probed = await probe(label, target, style === "google" ? undefined : apiKey, style);
  return { id, ...probed, configured: true };
}

async function probe(
  label: string,
  url: string,
  apiKey: string | undefined,
  style: "bearer" | "anthropic" | "google",
): Promise<{ label: string; status: ComponentStatus; detail: string }> {
  try {
    const headers: Record<string, string> = {};
    if (style === "bearer" && apiKey) headers.authorization = `Bearer ${apiKey}`;
    if (style === "anthropic" && apiKey) {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    }
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(4_000) });
    if (!response.ok) return { label, status: "unavailable", detail: `${label} did not accept a health check.` };
    return { label, status: "operational", detail: `${label} answered a credentialed health check.` };
  } catch {
    return { label, status: "unavailable", detail: `${label} health check timed out or could not connect.` };
  }
}

function live(
  id: ProviderId,
  label: string,
  configured: boolean,
  status: ComponentStatus,
  detail: string,
): ProviderStatus {
  return { id, label, configured, status, detail };
}
