"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { MODELS, PROVIDER_LABELS, PUBLIC_TENANTS, SAMPLE_PROMPT } from "@/data/catalogue";
import { ProviderMark } from "@/components/brand/providers";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatGbp } from "@/lib/money";
import type { GatewayResponseBody, GatewaySuccessBody } from "@/types/api";
import type { ProviderId } from "@/types/domain";

const REASONS: Record<string, string> = {
  exact_cache: "Exact cache",
  semantic_cache: "Semantic cache",
  model_routing: "Model optimisation",
  batch: "Batch",
  none: "None",
};

export function Playground() {
  const reduce = useReducedMotion();
  const [tenantId, setTenantId] = useState(PUBLIC_TENANTS[0]?.id ?? "");
  const [organisations, setOrganisations] = useState(PUBLIC_TENANTS.map((item) => ({ id: item.id, name: item.name })));
  const [demoMode, setDemoMode] = useState(false);
  const [modelOptions, setModelOptions] = useState(MODELS.map((item) => ({ ...item, available: true })));
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [prompt, setPrompt] = useState(SAMPLE_PROMPT);
  const [batchEligible, setBatchEligible] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<GatewayResponseBody | null>(null);
  const [visibleStep, setVisibleStep] = useState(0);

  const models = modelOptions.filter((item) => item.provider === provider);
  const selected = models.find((item) => item.id === model);
  const tenant = organisations.find((item) => item.id === tenantId);

  useEffect(() => {
    void fetch("/api/console/catalogue")
      .then((response) => response.json())
      .then((body: { ok?: boolean; demoMode?: boolean; tenants?: Array<{ id: string; name: string }>; models?: Array<(typeof MODELS)[number] & { available: boolean }> }) => {
        if (!body.ok) return;
        if (body.tenants && body.tenants.length > 0) setOrganisations(body.tenants);
        if (body.models) setModelOptions(body.models);
        setDemoMode(Boolean(body.demoMode));
      });
  }, []);

  async function send() {
    if (!tenant || selected?.available === false) return;
    setPending(true);
    setResult(null);
    setVisibleStep(0);
    try {
      const response = await fetch("/api/console/completions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id, provider, model, prompt, batchEligible, temperature: 0.2, maxTokens: 400 }),
      });
      const body = (await response.json()) as GatewayResponseBody;
      setResult(body);
      setPending(false);
      const steps = body.ok ? 6 : 2;
      if (reduce) {
        setVisibleStep(steps);
      } else {
        for (let step = 1; step <= steps; step += 1) {
          await wait(280);
          setVisibleStep(step);
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Playground"
        title="Send a request through the gateway."
        description="Choose an app, provider and model, then send a prompt. Vale screens personal data, checks cache and cost, then calls the model if needed."
      />
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5 md:p-6">
          <Select
            label="App"
            value={tenantId}
            onChange={setTenantId}
            options={organisations.map((item) => ({ value: item.id, label: item.name }))}
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
            <div className="hidden pb-1 sm:block">
              <ProviderMark id={provider} />
            </div>
            <Select
              label="Provider"
              value={provider}
              options={Object.entries(PROVIDER_LABELS).map(([id, label]) => ({ value: id, label }))}
              onChange={(next) => {
                const providerId = next as ProviderId;
                setProvider(providerId);
                const first = modelOptions.find((item) => item.provider === providerId);
                if (first) setModel(first.id);
              }}
            />
            <Select
              label="Model"
              value={model}
              onChange={setModel}
              options={models.map((item) => ({ value: item.id, label: item.available ? item.label : `${item.label} unavailable` }))}
            />
          </div>
          <label className="mt-4 block">
            <span className="block text-[13px] font-semibold text-ink">Prompt</span>
            <textarea className="field mt-2 min-h-40 resize-y leading-6" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          </label>
          <div className="mt-4">
            <Switch label="Can wait / batch eligible" checked={batchEligible} onChange={setBatchEligible} />
          </div>
          {demoMode ? (
            <p className="mt-4 text-sm leading-6 text-muted">Demo mode is on. Answers come from the deterministic provider, still through masking, cache, the database and the ledger.</p>
          ) : null}
          {selected && !selected.available ? (
            <p className="mt-4 text-sm leading-6 text-muted">This provider is not configured. The gateway will not invent a response.</p>
          ) : null}
          <Button className="mt-5 w-full" onClick={() => void send()} disabled={pending || prompt.trim().length === 0 || selected?.available === false}>
            {pending ? "Sending" : "Send request"}
          </Button>
        </Panel>
        <div>
          <Journey result={result} visibleStep={visibleStep} pending={pending} provider={provider} model={model} />
          {result?.ok ? <Metrics result={result} /> : null}
        </div>
      </div>
    </div>
  );
}

function Journey({
  result,
  visibleStep,
  pending,
  provider,
  model,
}: {
  result: GatewayResponseBody | null;
  visibleStep: number;
  pending: boolean;
  provider: ProviderId;
  model: string;
}) {
  const steps = useMemo(() => {
    if (!result) return [];
    if (!result.ok) {
      return [
        { title: "Original prompt", body: "The gateway accepted the call and resolved the organisation." },
        { title: "Request blocked", body: result.message },
      ];
    }
    const types = result.entities.map((entity) => `${entity.type} → ${entity.token}`).join("  ·  ") || "None detected";
    return [
      { title: "Original input", body: result.originalPrompt },
      { title: "Privacy screening", body: types },
      { title: "Masked input sent to provider", body: result.maskedPrompt },
      { title: "Provider request", body: `Provider: ${PROVIDER_LABELS[provider]}\nModel: ${model}\nPrivacy status: Protected` },
      { title: "AI response", body: result.providerResponse },
      { title: "Restored response", body: result.restoredResponse },
    ];
  }, [model, provider, result]);

  return (
    <Panel className="relative min-h-[420px] p-5 md:p-6">
      {pending ? <PageLoader label="Protecting and sending" /> : null}
      {!pending && !result ? <p className="text-sm leading-6 text-muted">The response, privacy path and cost appear here after you send a request.</p> : null}
      <ol className="space-y-3">
        <AnimatePresence>
          {steps.slice(0, visibleStep).map((step, index) => (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-[10px] border border-line bg-raised p-4"
            >
              <p className="text-[12px] font-medium text-muted">Step {index + 1}</p>
              <h2 className="mt-1 text-base font-medium">{step.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{step.body}</p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {result && !result.ok && visibleStep >= 2 ? (
        <div className="mt-4 rounded-[10px] border border-red-200/20 bg-red-400/10 p-4">
          <p className="text-lg font-medium">Request blocked.</p>
          <p className="mt-2 text-sm leading-6 text-muted">Fail-closed policy prevented unprotected data from reaching the AI provider.</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Provider contacted</dt>
              <dd>NO</dd>
            </div>
            <div>
              <dt className="text-muted">Sensitive data transmitted</dt>
              <dd>NO</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </Panel>
  );
}

function Metrics({ result }: { result: GatewaySuccessBody }) {
  const items = [
    ["Provider", PROVIDER_LABELS[result.metrics.provider]],
    ["Model", result.metrics.model],
    ["Latency", `${result.metrics.gatewayOverheadMs} ms`],
    ["Input tokens", String(result.metrics.inputTokens)],
    ["Output tokens", String(result.metrics.outputTokens)],
    ["Cost", formatGbp(result.metrics.providerCostMicros)],
    ["Savings", formatGbp(result.metrics.savingMicros)],
    ["Cache", result.metrics.cacheStatus],
    ["Privacy", "Protected"],
    ["Trace ID", result.requestId],
    ["Saving reason", REASONS[result.metrics.savingReason] ?? result.metrics.savingReason],
  ];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-[10px] border border-line bg-raised px-3 py-3">
          <dt className="text-[12px] text-muted">{label}</dt>
          <dd className="mt-1 break-all text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
