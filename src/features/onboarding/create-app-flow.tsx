"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ProviderMark } from "@/components/brand/providers";
import { Button } from "@/components/ui/button";
import { FieldLabel, Hint } from "@/components/ui/hint";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatGbp } from "@/lib/money";
import type { GatewayResponseBody } from "@/types/api";

const STEPS = ["App details", "Provider", "Privacy", "Budget", "API key", "Test request", "Complete"] as const;

type Environment = "development" | "staging" | "production";

interface Catalogue {
  demoMode: boolean;
  providers: Array<{ id: "openai" | "anthropic" | "google"; label: string; configured: boolean }>;
  models: Array<{ provider: string; id: string; label: string; available: boolean }>;
}

export function CreateAppFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [environment, setEnvironment] = useState<Environment>("development");
  const [description, setDescription] = useState("");
  const [preferred, setPreferred] = useState<Array<"openai" | "anthropic" | "google">>(["openai", "anthropic", "google"]);
  const [failClosed, setFailClosed] = useState(true);
  const [budgetGbp, setBudgetGbp] = useState(1000);
  const [warningGbp, setWarningGbp] = useState(800);
  const [cacheOn, setCacheOn] = useState(true);
  const [tenantId, setTenantId] = useState("");
  const [rawKey, setRawKey] = useState("");
  const [keyId, setKeyId] = useState("");
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [slugError, setSlugError] = useState("");
  const [pending, setPending] = useState(false);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [prompt, setPrompt] = useState("Summarise this clinical note without repeating identifiers.");
  const [provider, setProvider] = useState<"openai" | "anthropic" | "google">("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [result, setResult] = useState<GatewayResponseBody | null>(null);

  useEffect(() => {
    void fetch("/api/console/catalogue")
      .then((response) => response.json())
      .then((body: Catalogue & { ok?: boolean }) => {
        if (body.ok) setCatalogue(body);
      });
  }, []);

  const [origin, setOrigin] = useState("https://your-gateway.example");

  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
  }, []);
  const models = useMemo(() => (catalogue?.models ?? []).filter((item) => item.provider === provider), [catalogue, provider]);

  function slugFrom(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  async function createApp() {
    setPending(true);
    setError("");
    const response = await fetch("/api/console/organisations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        slug: slug || slugFrom(name),
        sector: "General",
        description,
        environment,
        preferredProviders: preferred.length ? preferred : ["openai", "anthropic", "google"],
        monthlyBudgetMicros: Math.round(budgetGbp * 1_000_000),
        spikeAlertThresholdMicros: Math.round(warningGbp * 1_000_000),
        fallbackPolicy: failClosed ? "fail_closed" : "fail_open",
        exactCacheEnabled: cacheOn,
      }),
    });
    const body = (await response.json()) as { ok?: boolean; organisation?: { id: string }; message?: string };
    setPending(false);
    if (!body.ok || !body.organisation) {
      const message = body.message ?? "The app could not be created.";
      setError(message);
      if (message.toLowerCase().includes("name")) setNameError(message);
      if (message.toLowerCase().includes("slug")) setSlugError(message);
      return false;
    }
    setTenantId(body.organisation.id);
    return true;
  }

  async function savePolicy() {
    if (!tenantId) return false;
    setPending(true);
    setError("");
    const current = (await fetch(`/api/console/organisations/${tenantId}`).then((response) => response.json())) as {
      settings?: Record<string, unknown>;
      message?: string;
    };
    if (!current.settings) {
      setPending(false);
      setError(current.message ?? "Settings could not be loaded.");
      return false;
    }
    const response = await fetch(`/api/console/organisations/${tenantId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "settings",
        settings: {
          ...current.settings,
          preferredProviders: preferred,
          fallbackPolicy: failClosed ? "fail_closed" : "fail_open",
          monthlyBudgetMicros: Math.round(budgetGbp * 1_000_000),
          spikeAlertThresholdMicros: Math.round(warningGbp * 1_000_000),
          exactCacheEnabled: cacheOn,
          description,
          environment,
          slug,
        },
      }),
    });
    const body = (await response.json()) as { ok?: boolean; message?: string };
    setPending(false);
    if (!body.ok) {
      setError(body.message ?? "Settings were not saved.");
      return false;
    }
    return true;
  }

  async function generateKey() {
    if (!tenantId) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/console/organisations/${tenantId}/keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Primary",
        regenerate: Boolean(keyId),
        confirm: keyId ? "REGENERATE" : undefined,
        keyId: keyId || undefined,
      }),
    });
    const body = (await response.json()) as { ok?: boolean; apiKey?: { rawKey: string; id: string }; message?: string };
    setPending(false);
    if (!body.apiKey) {
      setError(body.message ?? "The API key was not created.");
      return;
    }
    setRawKey(body.apiKey.rawKey);
    setKeyId(body.apiKey.id);
  }

  async function sendTest() {
    if (!tenantId) return;
    setPending(true);
    setResult(null);
    const response = await fetch("/api/console/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId, provider, model, prompt, batchEligible: false, temperature: 0.2, maxTokens: 200 }),
    });
    setResult((await response.json()) as GatewayResponseBody);
    setPending(false);
  }

  async function next() {
    if (step === 0) {
      const nextSlug = slug || slugFrom(name);
      const nextNameError = name.trim().length < 2 ? "Enter an app name of at least two characters." : "";
      const nextSlugError = nextSlug.length < 2 ? "Enter a slug using lowercase letters, numbers and hyphens." : "";
      setNameError(nextNameError);
      setSlugError(nextSlugError);
      if (nextNameError || nextSlugError) return;
      if (!tenantId && !(await createApp())) return;
    }
    if (step === 3 && tenantId && !(await savePolicy())) return;
    setError("");
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  const titles = [
    ["Name the application", "This is the product or team that will send AI requests through Vale."],
    ["Choose AI providers", "Enable the model vendors this app is allowed to use. Secrets stay on the server."],
    ["Confirm privacy defaults", "Vale screens every prompt for UK personal data before a model is contacted."],
    ["Set spend controls", "A monthly budget stops further model calls when the limit would be exceeded."],
    ["Create the API key", "Your application authenticates with this key. Vale stores only a hash."],
    ["Send a test request", "Prove the path works, or see a clear message if a provider key is missing."],
    ["App is ready", "You can return to this organisation at any time to change policy or rotate keys."],
  ] as const;

  return (
    <div>
      <PageHeader
        eyebrow="Create app"
        title="Connect an application to Vale."
        description="Create the app, choose providers, keep privacy fail-closed, set a budget, issue a one-time API key, then send a test request."
      />
      <ol className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {STEPS.map((label, index) => {
          const state = index === step ? "active" : index < step ? "done" : "todo";
          return (
            <li key={label} className="flex min-w-max items-center gap-2">
              <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${state === "active" ? "bg-accent text-accent-ink" : state === "done" ? "bg-accent/20 text-accent" : "bg-raised text-muted"}`}>
                {state === "done" ? "✓" : index + 1}
              </span>
              <span className={`text-[13px] ${state === "todo" ? "text-muted" : "font-medium text-ink"}`}>{label}</span>
              {index < STEPS.length - 1 ? <span className="mx-1 h-px w-6 bg-line" /> : null}
            </li>
          );
        })}
      </ol>
      <Panel className="p-5 md:p-6">
        <h2 className="text-[20px] font-semibold">{titles[step][0]}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{titles[step][1]}</p>
        <div className="mt-5">
          {step === 0 ? (
            <div className="grid gap-4">
              <Field label="App name" value={name} error={nameError} onChange={(value) => { setName(value); setNameError(""); if (!slug || slug === slugFrom(name)) setSlug(slugFrom(value)); }} hint="Shown in the console and on usage reports." />
              <Field label="Slug" value={slug} error={slugError} onChange={(value) => { setSlug(value); setSlugError(""); }} hint="A stable lowercase identifier for URLs and automation. Use letters, numbers and hyphens." />
              <div>
                <label className="block">
                  <FieldLabel>Environment</FieldLabel>
                  <select className="field mt-2" value={environment} onChange={(event) => setEnvironment(event.target.value as Environment)}>
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </label>
                <Hint>Use development while you integrate. Production should have a real budget and provider keys.</Hint>
              </div>
              <div>
                <label className="block">
                  <FieldLabel>Description</FieldLabel>
                  <textarea className="field mt-2 min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} />
                </label>
                <Hint>Optional. Helps operators recognise the app later.</Hint>
              </div>
            </div>
          ) : null}
          {step === 1 ? (
            <div>
              <ul className="space-y-3">
                {(catalogue?.providers ?? []).map((item) => {
                  const enabled = preferred.includes(item.id);
                  return (
                    <li key={item.id} className="flex flex-col gap-3 rounded-[10px] border border-line bg-raised p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <ProviderMark id={item.id} />
                        <div>
                          <p className="text-[15px] font-semibold">{item.label}</p>
                          <p className="mt-1 text-[13px] text-muted">
                            {item.configured ? "Models are available for this app when enabled." : "Add a server-side API key. Vale will not invent an answer."}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {!item.configured ? (
                          <>
                            <StatusBadge label="Not configured" tone="warn" />
                            <Link href="/settings">
                              <Button variant="secondary">Configure</Button>
                            </Link>
                          </>
                        ) : (
                          <>
                            <StatusBadge label={enabled ? "Active" : "Configured"} tone={enabled ? "ok" : "neutral"} />
                            <button
                              type="button"
                              role="switch"
                              aria-checked={enabled}
                              aria-label={`${enabled ? "Disable" : "Enable"} ${item.label}`}
                              onClick={() => setPreferred((current) => (current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]))}
                              className="flex items-center gap-2"
                            >
                              <span className="text-[12px] text-muted">{enabled ? "Disable" : "Enable"}</span>
                              <span className={`relative h-6 w-10 rounded-full p-0.5 ${enabled ? "bg-accent" : "bg-line"}`}>
                                <span className={`block h-5 w-5 rounded-full bg-surface transition ${enabled ? "translate-x-4" : "translate-x-0"}`} />
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {catalogue && !catalogue.demoMode && catalogue.providers.every((item) => !item.configured) ? (
                <p className="mt-4 text-sm text-amber-800 dark:text-amber-100">Live model calls are unavailable until a server-side provider key is set. Vale will not invent a successful response.</p>
              ) : null}
            </div>
          ) : null}
          {step === 2 ? (
            <div className="grid gap-3">
              <div className="rounded-[10px] border border-line bg-raised p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">PII protection</p>
                  <StatusBadge label="Always on" tone="ok" />
                </div>
                <p className="mt-2 text-[13px] leading-6 text-muted">Personal identifiers such as NHS numbers are replaced with placeholders before a provider is called. The original values are restored only for your app.</p>
              </div>
              <div className="rounded-[10px] border border-line bg-raised p-4">
                <p className="font-medium">Fail closed</p>
                <p className="mt-2 text-[13px] leading-6 text-muted">If privacy checks cannot complete safely, Vale blocks the request rather than sending potentially sensitive information to an AI provider.</p>
                <Button className="mt-4" variant={failClosed ? "secondary" : "danger"} onClick={() => setFailClosed((value) => !value)}>
                  {failClosed ? "Keep fail closed (recommended)" : "Record fail open — still blocked when unscreened"}
                </Button>
              </div>
            </div>
          ) : null}
          {step === 3 ? (
            <div className="grid gap-4">
              <Field label="Monthly budget (£)" value={String(budgetGbp)} onChange={(value) => setBudgetGbp(Number(value) || 0)} hint="When this amount would be exceeded, Vale returns a budget error and does not contact a provider." />
              <Field label="Warning / spike threshold (£)" value={String(warningGbp)} onChange={(value) => setWarningGbp(Number(value) || 0)} hint="A sudden burst of spend above this level is treated as a runaway-agent risk and blocked." />
              <button type="button" className="rounded-[10px] border border-line bg-raised px-4 py-4 text-left" onClick={() => setCacheOn((value) => !value)}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Exact cache</p>
                  <StatusBadge label={cacheOn ? "On" : "Off"} tone={cacheOn ? "ok" : "neutral"} />
                </div>
                <Hint>If the same screened prompt is sent again, Vale can reuse the stored answer and avoid a second provider charge. Semantic cache is planned and stays off.</Hint>
              </button>
            </div>
          ) : null}
          {step === 4 ? (
            <div>
              <div className="rounded-[10px] border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-50">
                Copy this now. The raw API key is shown once. Vale stores only its hash and cannot display it again.
              </div>
              {rawKey ? (
                <p className="mt-4 break-all rounded-[8px] border border-accent/30 bg-accent/10 p-4 font-mono text-sm">{rawKey}</p>
              ) : (
                <p className="mt-4 text-sm text-muted">No key generated yet for this app.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={() => void generateKey()} disabled={pending || !tenantId}>
                  {rawKey ? "Regenerate key" : "Generate API key"}
                </Button>
                {rawKey ? (
                  <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(rawKey)}>
                    Copy
                  </Button>
                ) : null}
              </div>
              <div className="mt-6 space-y-3 text-sm">
                <p>Send requests to <code className="text-accent">{origin}/api/v1/chat/completions</code> with <code>Authorization: Bearer {rawKey || "YOUR_API_KEY"}</code>.</p>
                <pre className="overflow-x-auto rounded-[8px] bg-input p-4 font-mono text-xs leading-6">{`curl ${origin}/api/v1/chat/completions \\
  -H "authorization: Bearer ${rawKey || "YOUR_API_KEY"}" \\
  -H "content-type: application/json" \\
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'`}</pre>
                <p className="text-muted">Also available: GET /api/v1/models, GET /api/v1/usage, GET /api/v1/health.</p>
              </div>
            </div>
          ) : null}
          {step === 5 ? (
            <div>
              <div className="grid gap-4 md:grid-cols-2">
                <Select label="Provider" value={provider} onChange={(value) => setProvider(value as typeof provider)} options={(catalogue?.providers ?? []).map((item) => ({ value: item.id, label: item.label }))} />
                <Select label="Model" value={model} onChange={setModel} options={models.map((item) => ({ value: item.id, label: item.available ? item.label : `${item.label} (unavailable)` }))} />
              </div>
              <label className="mt-4 block">
                <FieldLabel>Prompt</FieldLabel>
                <textarea className="field mt-2 min-h-28" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              </label>
              <Button className="mt-4" onClick={() => void sendTest()} disabled={pending || !tenantId}>
                {pending ? "Sending" : "Send test request"}
              </Button>
              {result && !result.ok ? (
                <Panel className="mt-4 border-amber-300/20 bg-amber-400/8 p-4 text-sm">
                  <p>{result.message}</p>
                  <p className="mt-2 text-muted">This is not a successful call. Configure a provider key or use DEMO_MODE for a deterministic answer.</p>
                </Panel>
              ) : null}
              {result && result.ok ? (
                <div className="mt-4 grid gap-3 text-sm">
                  <p className="rounded-[10px] border border-line bg-raised p-4">{result.restoredResponse}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Metric label="Latency" value={`${result.metrics.gatewayOverheadMs} ms`} />
                    <Metric label="Tokens" value={`${result.metrics.inputTokens} / ${result.metrics.outputTokens}`} />
                    <Metric label="Cost" value={formatGbp(result.metrics.providerCostMicros, 4)} />
                    <Metric label="Savings" value={formatGbp(result.metrics.savingMicros, 4)} />
                    <Metric label="Cache" value={result.metrics.cacheStatus} />
                    <Metric label="Privacy" value="Protected" />
                  </div>
                  <Link className="text-accent" href="/requests">Open the request trace</Link>
                </div>
              ) : null}
            </div>
          ) : null}
          {step === 6 ? (
            <div className="text-sm leading-6 text-muted">
              <p>{name} is registered. API status, budget, privacy and keys are on the organisation page.</p>
              <p className="mt-2">If you still need the raw key, generate a new one there — the previous value cannot be retrieved.</p>
            </div>
          ) : null}
        </div>
        {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {step > 0 ? (
            <Button variant="secondary" onClick={() => setStep((value) => value - 1)}>
              Back
            </Button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => void next()} disabled={pending}>
              Continue
            </Button>
          ) : (
            <Button onClick={() => router.push(tenantId ? `/organisations/${tenantId}` : "/organisations")} disabled={!tenantId}>
              Open app overview
            </Button>
          )}
          {tenantId ? (
            <Link href={`/organisations/${tenantId}`} className="text-sm text-muted hover:text-ink">
              Save and finish later
            </Link>
          ) : (
            <Link href="/organisations" className="text-sm text-muted hover:text-ink">
              Cancel
            </Link>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="block">
        <FieldLabel>{label}</FieldLabel>
        <input className={`field mt-2 ${error ? "field-error" : ""}`} value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
      {hint ? <Hint>{hint}</Hint> : null}
      {error ? <p className="mt-1 text-[13px] text-red-700 dark:text-red-200">{error}</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-line bg-raised px-3 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
