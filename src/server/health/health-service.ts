import type { ComponentStatus, HealthComponent, HealthSnapshot } from "@/types/domain";

export class HealthService {
  private piiAvailable = true;

  setPiiAvailable(available: boolean): void {
    this.piiAvailable = available;
  }

  isPiiAvailable(): boolean {
    return this.piiAvailable;
  }

  snapshot(input: {
    postgresConfigured: boolean;
    redisConfigured: boolean;
    postgresLive?: boolean;
    redisLive?: boolean;
    cacheMode?: "redis" | "memory";
  }): HealthSnapshot {
    const components: HealthComponent[] = [
      { id: "gateway", label: "Gateway API", status: "healthy", detail: "Accepting screened completions." },
      {
        id: "pii",
        label: "PII protection",
        status: this.piiAvailable ? "healthy" : "unavailable",
        detail: this.piiAvailable ? "Detection and tokenisation available." : "Unavailable. New requests fail closed.",
      },
      {
        id: "redis",
        label: "Redis",
        status: input.cacheMode === "redis" ? (input.redisLive ? "healthy" : "unavailable") : "not_configured",
        detail:
          input.cacheMode === "redis"
            ? input.redisLive
              ? "Exact cache is using Redis."
              : "REDIS_URL is set, but Redis did not answer. Exact cache degrades; privacy still runs."
            : "Redis is not configured. The process uses an in-memory cache. This is not a system failure.",
      },
      {
        id: "postgres",
        label: "PostgreSQL",
        status: input.postgresLive ? "healthy" : input.postgresConfigured ? "unavailable" : "not_configured",
        detail: input.postgresLive
          ? "Lakebase Postgres is the system of record."
          : input.postgresConfigured
            ? "DATABASE_URL is set, but the database did not answer."
            : "PostgreSQL is not configured. In-memory repositories are the local fallback. This is not a system failure.",
      },
      { id: "openai", label: "OpenAI", status: "operational", detail: "Route available through the provider port." },
      { id: "anthropic", label: "Anthropic", status: "operational", detail: "Route available through the provider port." },
      { id: "google", label: "Google", status: "operational", detail: "Route available through the provider port." },
    ];

    return {
      piiAvailable: this.piiAvailable,
      components,
      checkedAt: new Date().toISOString(),
    };
  }
}

export function statusTone(status: ComponentStatus): "ok" | "bad" | "warn" {
  if (status === "unavailable") return "bad";
  if (status === "degraded" || status === "not_configured") return "warn";
  return "ok";
}
