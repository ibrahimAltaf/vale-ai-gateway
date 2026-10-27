"use client";

import { Activity, Database, Server, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { SAMPLE_PROMPT } from "@/data/catalogue";
import { ProviderMark } from "@/components/brand/providers";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { Panel } from "@/components/ui/panel";
import { StatusBadge, toneForHealth } from "@/components/ui/status-badge";
import type { GatewayResponseBody, HealthBody } from "@/types/api";

const ICONS: Record<string, typeof Server> = {
  gateway: Activity,
  pii: ShieldCheck,
  redis: Server,
  postgres: Database,
};

export function HealthView() {
  const [health, setHealth] = useState<HealthBody | null>(null);
  const [probe, setProbe] = useState<GatewayResponseBody | null>(null);
  const [pending, setPending] = useState(false);
  const [tenantId, setTenantId] = useState("");

  async function load() {
    const response = await fetch("/api/console/health");
    setHealth((await response.json()) as HealthBody);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/console/health")
      .then((response) => response.json())
      .then((body: HealthBody) => {
        if (!cancelled) setHealth(body);
      });
    void fetch("/api/console/catalogue")
      .then((response) => response.json())
      .then((body: { tenants?: Array<{ id: string }> }) => {
        if (!cancelled && body.tenants?.[0]) setTenantId(body.tenants[0].id);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (!health) return;
    await fetch("/api/console/health", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ piiAvailable: !health.health.piiAvailable }),
    });
    setProbe(null);
    await load();
  }

  async function sendProbe() {
    if (!tenantId) return;
    setPending(true);
    const response = await fetch("/api/console/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId,
        provider: "openai",
        model: "gpt-4o-mini",
        prompt: SAMPLE_PROMPT,
        batchEligible: false,
        temperature: 0.2,
        maxTokens: 200,
      }),
    });
    setProbe((await response.json()) as GatewayResponseBody);
    setPending(false);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Health"
        title="If privacy is down, the request stops."
        description="Vale is the control layer in front of OpenAI, Anthropic and Google. A missing provider key is not a system failure — it is shown as not configured."
      />
      {!health ? <PageLoader label="Checking services" /> : null}
      {health ? (
        <div className="space-y-5">
          <Section title="Core infrastructure" items={health.health.components.filter((item) => ["gateway", "postgres", "redis", "pii"].includes(item.id))} />
          <Section title="AI providers" items={health.health.components.filter((item) => ["openai", "anthropic", "google"].includes(item.id))} />
        </div>
      ) : null}
      {health ? (
        <div className="mt-6">
          <h2 className="mb-2 text-[18px] font-semibold">Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => void sendProbe()} disabled={pending}>
              {pending ? "Sending probe" : "Send a probe request"}
            </Button>
            <Button variant={health.health.piiAvailable ? "danger" : "primary"} onClick={() => void toggle()}>
              {health.health.piiAvailable ? "Simulate privacy service failure" : "Restore privacy protection"}
            </Button>
          </div>
        </div>
      ) : null}
      {probe && !probe.ok ? (
        <Panel className="mt-6 border-red-300/20 bg-red-500/10 p-6">
          <p className="text-xl font-medium">Request blocked.</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Fail-closed policy prevented unprotected data from reaching the AI provider.
          </p>
          <dl className="mt-5 grid max-w-md grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Provider contacted</dt>
              <dd>NO</dd>
            </div>
            <div>
              <dt className="text-muted">Sensitive data transmitted</dt>
              <dd>NO</dd>
            </div>
          </dl>
        </Panel>
      ) : null}
      {probe?.ok ? <p className="mt-6 text-sm text-muted">Probe completed with privacy protection active. Provider contacted: yes. Sensitive data transmitted: no.</p> : null}
      <Panel className="mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[18px] font-semibold">Policy</h2>
          <p className="mt-1 text-[13px] text-muted">Even if fail-open is recorded, Vale still refuses unscreened traffic.</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-raised text-[12px] text-muted">
            <tr>
              <th className="px-5 py-2.5 font-semibold">App</th>
              <th className="px-5 py-2.5 font-semibold">Policy</th>
            </tr>
          </thead>
          <tbody>
            {health?.policies.map((policy) => (
              <tr key={policy.tenantId} className="border-t border-line">
                <td className="px-5 py-3">{policy.name}</td>
                <td className="px-5 py-3">
                  <StatusBadge label={policy.fallbackPolicy === "fail_closed" ? "Fail closed" : "Fail open recorded"} tone="ok" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function Section({ title, items }: { title: string; items: HealthBody["health"]["components"] }) {
  return (
    <div>
      <h2 className="mb-2 text-[18px] font-semibold">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((component) => {
          const Icon = ICONS[component.id];
          const provider = ["openai", "anthropic", "google"].includes(component.id);
          return (
            <Panel key={component.id} className="flex items-start justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                {provider ? <ProviderMark id={component.id} /> : Icon ? <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-raised text-accent ring-1 ring-line"><Icon size={18} strokeWidth={1.6} /></span> : null}
                <div>
                  <p className="text-[15px] font-semibold">{component.label}</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted">{component.detail}</p>
                </div>
              </div>
              <StatusBadge label={component.status.replaceAll("_", " ")} tone={toneForHealth(component.status)} />
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
