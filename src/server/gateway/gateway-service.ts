import { CostCalculator, estimateTokens } from "@/server/cost/calculator";
import { PricingService } from "@/server/cost/pricing";
import {
  BudgetExceededError,
  DailyLimitExceededError,
  SpikeDetectedError,
  DomainError,
  PIIServiceUnavailableError,
  ProviderUnavailableError,
} from "@/server/domain/errors";
import { createId } from "@/server/domain/ids";
import { CacheService } from "@/server/cache/cache-service";
import { HealthService } from "@/server/health/health-service";
import { AuditService } from "@/server/observability/audit-service";
import { TraceClock } from "@/server/observability/trace";
import { PrivacyService } from "@/server/privacy/privacy-service";
import { ProviderService } from "@/server/providers/router";
import type {
  LedgerRepository,
  OperatingMetricsStore,
  RequestRepository,
  TenantRepository,
} from "@/server/repositories/contracts";
import type {
  CacheStatus,
  CostBreakdown,
  GatewayRequestInput,
  GatewayRequestMetadata,
  MaskedPrompt,
  RequestTrace,
  SavingsEntry,
  Tenant,
} from "@/types/domain";

export interface CompletedRequest {
  requestId: string;
  tenant: Tenant;
  masked: MaskedPrompt;
  providerText: string;
  restoredText: string;
  providerContacted: boolean;
  cost: CostBreakdown;
  trace: RequestTrace;
  cacheStatus: CacheStatus;
  cacheDisplay: string;
  privacyContextLabel: string;
}

export type GatewayOutcome =
  | { type: "completed"; value: CompletedRequest }
  | { type: "blocked"; error: DomainError; trace: RequestTrace };

export class GatewayService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly requests: RequestRepository,
    private readonly ledger: LedgerRepository,
    private readonly privacy: PrivacyService,
    private readonly cache: CacheService,
    private readonly providers: ProviderService,
    private readonly pricing: PricingService,
    private readonly costs: CostCalculator,
    private readonly health: HealthService,
    private readonly audit: AuditService,
    private readonly metrics: OperatingMetricsStore,
  ) {}

  async execute(tenant: Tenant, input: GatewayRequestInput, requestId: string): Promise<GatewayOutcome> {
    const clock = new TraceClock();
    clock.mark("received", "Request received", "Gateway accepted the call.");
    clock.mark("tenant", "Tenant authenticated", `API key resolved to ${tenant.name}.`);

    const admission = await this.tenants.recordRequest(tenant.id);
    if (!admission.allowed) {
      clock.mark("blocked", "Daily limit reached", "The organisation is over its daily request limit.");
      return this.block(tenant, input, new DailyLimitExceededError(requestId), clock.finish(requestId, 0));
    }

    const priced = this.pricing.resolve(input.provider, input.model);
    if (!priced) {
      const error = new DomainError("INVALID_REQUEST", "The selected model is not in the pricing catalogue.", 400, requestId);
      return this.block(tenant, input, error, clock.finish(requestId, 0));
    }

    const estimate = this.costs.quote({
      priced,
      inputTokens: estimateTokens(input.prompt),
      outputTokens: input.maxTokens,
      cacheStatus: "miss",
      batchEligible: false,
    });
    if (!tenant.settings.preferredProviders.includes(input.provider)) {
      const error = new DomainError("INVALID_REQUEST", "That provider is not enabled for this organisation.", 400, requestId);
      return this.block(tenant, input, error, clock.finish(requestId, 0));
    }
    if (tenant.settings.enabledModels.length > 0 && !tenant.settings.enabledModels.includes(input.model)) {
      const error = new DomainError("INVALID_REQUEST", "That model is not enabled for this organisation.", 400, requestId);
      return this.block(tenant, input, error, clock.finish(requestId, 0));
    }
    if (
      admission.spendMicros >= tenant.settings.monthlyBudgetMicros ||
      admission.spendMicros + estimate.baselineMicros > tenant.settings.monthlyBudgetMicros
    ) {
      clock.mark("budget", "Budget policy checked", "Monthly budget would be exceeded.");
      return this.block(tenant, input, new BudgetExceededError(requestId), clock.finish(requestId, 0));
    }
    if (estimate.baselineMicros > tenant.settings.perRequestMaxMicros) {
      clock.mark("budget", "Per-request cap", "The estimate is above the per-request maximum.");
      return this.block(tenant, input, new BudgetExceededError(requestId), clock.finish(requestId, 0));
    }
    if (tenant.settings.spikeAlertThresholdMicros > 0) {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const recent = await this.ledger.spendSince(tenant.id, since);
      if (recent + estimate.baselineMicros > tenant.settings.spikeAlertThresholdMicros) {
        clock.mark("budget", "Runaway guard", "Five-minute spend is above the spike threshold.");
        return this.block(tenant, input, new SpikeDetectedError(requestId), clock.finish(requestId, 0));
      }
    }
    clock.mark("budget", "Budget policy checked", "Monthly budget, per-request cap and spike guard allowed the request.");

    const protectedPrompt = this.screen(input.prompt, requestId);
    if (protectedPrompt instanceof PIIServiceUnavailableError) {
      clock.mark("pii-down", "PII protection unavailable", "Fail-closed policy stopped the request.");
      clock.mark("blocked", "Request blocked", "Unscreened content was not forwarded.");
      return this.block(tenant, input, protectedPrompt, clock.finish(requestId, 0));
    }

    clock.mark("pii-start", "PII detection started", "UK privacy pipeline running before any provider call.");
    const count = protectedPrompt.entities.length;
    clock.mark(
      "pii-done",
      count === 1 ? "1 PII entity protected" : `${count} PII entities protected`,
      count === 0 ? "No sensitive entities detected." : "Entities replaced with request-scoped placeholders.",
    );

    const cacheKey = this.cache.buildKey({
      tenantId: tenant.id,
      provider: input.provider,
      model: input.model,
      maskedPrompt: protectedPrompt.masked,
      sensitiveValues: protectedPrompt.placeholders.map((item) => `${item.type}:${item.value}`),
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      batchEligible: input.batchEligible,
    });

    clock.mark("cache-lookup", "Cache lookup", "Exact cache key computed inside the tenant namespace.");
    const lookup = await this.cache.lookup(tenant.id, cacheKey, tenant.settings.exactCacheEnabled);
    if (lookup.status === "hit") {
      clock.mark("cache-result", "Cache hit", "Provider was not contacted.");
    } else if (lookup.status === "miss") {
      clock.mark("cache-result", "Cache miss", "No reusable completion for this privacy context.");
    } else if (lookup.status === "bypassed") {
      clock.mark("cache-result", "Cache bypassed", "Exact cache is disabled for this organisation.");
    } else {
      clock.mark("cache-result", "Cache unavailable", "Lookup failed. The masked request can still continue.");
    }

    let providerText = lookup.entry?.maskedResponse ?? "";
    let inputTokens = lookup.entry?.inputTokens ?? estimateTokens(protectedPrompt.masked);
    let outputTokens = lookup.entry?.outputTokens ?? 0;
    let providerLatencyMs = 0;
    let providerContacted = false;

    if (!lookup.entry) {
      clock.mark("provider", "Provider selected", `${input.provider} · ${input.model}. Prompt is masked.`);
      try {
        const completion = await this.providers.resolve(input.provider).complete({
          provider: input.provider,
          model: input.model,
          maskedPrompt: protectedPrompt.masked,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
        });
        providerText = completion.text;
        inputTokens = completion.inputTokens;
        outputTokens = completion.outputTokens;
        providerLatencyMs = completion.latencyMs;
        providerContacted = true;
        clock.mark("provider-done", "Provider response received", `Provider latency ${completion.latencyMs} ms.`);
        await this.cache.storeCompletion(
          tenant.id,
          cacheKey,
          {
            maskedResponse: completion.text,
            inputTokens,
            outputTokens,
            provider: input.provider,
            model: input.model,
            storedAt: new Date().toISOString(),
          },
          tenant.settings.exactCacheEnabled && lookup.status !== "unavailable",
          tenant.settings.cacheTtlSeconds,
        );
      } catch {
        clock.mark("provider-failed", "Provider failed", "The provider error did not include prompt content.");
        const trace = clock.finish(requestId, 0);
        await this.persistBlocked(tenant, input, trace, "PROVIDER_UNAVAILABLE", lookup.status, count);
        await this.audit.record({
          requestId,
          tenantId: tenant.id,
          event: "provider.failed",
          provider: input.provider,
          model: input.model,
          cacheStatus: lookup.status,
          piiEntityCount: count,
        });
        return { type: "blocked", error: new ProviderUnavailableError(requestId, input.provider), trace };
      }
    } else {
      await this.tenants.recordCacheHit(tenant.id);
      await this.metrics.recordCacheHit();
    }

    const restoredText = this.privacy.restore(providerText, protectedPrompt.placeholders);
    clock.mark("restore", "PII restored", "Placeholders replaced for this request only.");

    const cost = this.costs.quote({
      priced,
      inputTokens,
      outputTokens,
      cacheStatus: lookup.status === "hit" ? "hit" : "miss",
      batchEligible: input.batchEligible && lookup.status !== "hit",
    });

    const entry: SavingsEntry = {
      id: createId("led"),
      tenantId: tenant.id,
      requestId,
      createdAt: new Date().toISOString(),
      provider: input.provider,
      model: input.model,
      inputTokens,
      outputTokens,
      pricingVersion: cost.pricingVersion,
      baselineMicros: cost.baselineMicros,
      actualMicros: cost.actualMicros,
      gatewaySavingMicros: cost.gatewaySavingMicros,
      providerNativeDiscountMicros: 0,
      reason: cost.reason,
    };
    await this.ledger.insert(entry);
    await this.tenants.addSpend(tenant.id, cost.actualMicros);
    clock.mark("ledger", "Ledger updated", "Metadata posted. Prompt content was not stored.");

    const trace = clock.finish(requestId, providerLatencyMs);
    await this.requests.insert(metadata(tenant, input, requestId, trace, cost, lookup.status, protectedPrompt, false));
    await this.metrics.recordCompletion(count, cost.gatewaySavingMicros, trace.gatewayOverheadMs);

    await this.audit.record({
      requestId,
      tenantId: tenant.id,
      event: "provider.completed",
      provider: input.provider,
      model: input.model,
      latencyMs: providerLatencyMs,
      cacheStatus: lookup.status,
      piiEntityCount: count,
      savingReason: cost.reason,
    });

    return {
      type: "completed",
      value: {
        requestId,
        tenant,
        masked: protectedPrompt,
        providerText,
        restoredText,
        providerContacted,
        cost,
        trace,
        cacheStatus: lookup.status,
        cacheDisplay: cacheKey.display,
        privacyContextLabel: cacheKey.privacyContextLabel,
      },
    };
  }

  private screen(prompt: string, requestId: string): MaskedPrompt | PIIServiceUnavailableError {
    if (!this.health.isPiiAvailable()) {
      return new PIIServiceUnavailableError(requestId);
    }
    try {
      return this.privacy.protect(prompt);
    } catch {
      return new PIIServiceUnavailableError(requestId);
    }
  }

  private async block(
    tenant: Tenant,
    input: GatewayRequestInput,
    error: DomainError,
    trace: RequestTrace,
  ): Promise<GatewayOutcome> {
    await this.persistBlocked(tenant, input, trace, error.code, "bypassed", 0);
    await this.audit.record({
      requestId: error.requestId,
      tenantId: tenant.id,
      event: error.code === "BUDGET_EXCEEDED" || error.code === "SPIKE_DETECTED" ? "budget.exceeded" : "gateway.blocked",
      provider: input.provider,
      model: input.model,
    });
    return { type: "blocked", error, trace };
  }

  private async persistBlocked(
    tenant: Tenant,
    input: GatewayRequestInput,
    trace: RequestTrace,
    code: string,
    cacheStatus: CacheStatus,
    piiEntityCount: number,
  ): Promise<void> {
    const emptyCost: CostBreakdown = {
      pricingVersion: "2026-04-01",
      currency: "GBP",
      inputTokens: 0,
      outputTokens: 0,
      baselineMicros: 0,
      actualMicros: 0,
      gatewaySavingMicros: 0,
      providerNativeDiscountMicros: 0,
      reason: "none",
    };
    await this.requests.insert(
      metadata(tenant, input, trace.requestId, trace, emptyCost, cacheStatus, null, true, code, piiEntityCount),
    );
    await this.metrics.recordOverhead(trace.gatewayOverheadMs);
  }
}

function metadata(
  tenant: Tenant,
  input: GatewayRequestInput,
  requestId: string,
  trace: RequestTrace,
  cost: CostBreakdown,
  cacheStatus: CacheStatus,
  masked: MaskedPrompt | null,
  blocked: boolean,
  blockCode?: string,
  piiEntityCount = masked?.entities.length ?? 0,
): GatewayRequestMetadata {
  return {
    id: requestId,
    tenantId: tenant.id,
    createdAt: new Date().toISOString(),
    provider: input.provider,
    model: input.model,
    cacheStatus,
    piiEntityCount,
    piiTypes: masked?.entities.map((entity) => entity.type) ?? [],
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
    baselineMicros: cost.baselineMicros,
    actualMicros: cost.actualMicros,
    gatewaySavingMicros: cost.gatewaySavingMicros,
    savingReason: cost.reason,
    gatewayOverheadMs: trace.gatewayOverheadMs,
    providerLatencyMs: trace.providerLatencyMs,
    totalMs: trace.totalMs,
    blocked,
    blockCode,
    trace,
  };
}
