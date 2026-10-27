"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageEmpty, QueryState } from "@/components/ui/page-state";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatGbp, formatWhen } from "@/lib/money";
import { readJson } from "@/lib/load-state";

interface OrganisationDetail {
  ok: true;
  tenantId: string;
  name: string;
  sector: string;
  archivedAt: string | null;
  settings: {
    slug: string;
    description: string;
    environment: string;
    monthlyBudgetMicros: number;
    spikeAlertThresholdMicros: number;
    fallbackPolicy: "fail_closed" | "fail_open";
    exactCacheEnabled: boolean;
    preferredProviders: string[];
  };
  keys: Array<{ id: string; name: string; prefix: string; createdAt: string; revokedAt: string | null; lastUsedAt: string | null }>;
  usage: { spendMicros: number; savingsMicros: number; requestsToday: number; monthRequests: number; monthCacheHits: number };
  recentRequests: Array<{
    id: string;
    createdAt: string;
    provider: string;
    model: string;
    cacheStatus: string;
    blocked: boolean;
    totalMs: number;
    actualMicros: number;
    savingMicros: number;
  }>;
}

export function OrganisationDetail() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<OrganisationDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [rawKey, setRawKey] = useState("");
  const [message, setMessage] = useState("");
  const [archiveConfirm, setArchiveConfirm] = useState("");
  const [tab, setTab] = useState("Overview");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    void readJson<OrganisationDetail>(`/api/console/organisations/${params.id}`)
      .then((body) => {
        setData(body);
        setLoading(false);
      })
      .catch((caught: Error) => {
        setError(caught.message);
        setLoading(false);
      });
  }, [params.id]);

  useEffect(() => {
    queueMicrotask(() => load());
  }, [load]);

  async function createKey(regenerate?: { keyId: string }) {
    const response = await fetch(`/api/console/organisations/${params.id}/keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Primary",
        regenerate: Boolean(regenerate),
        confirm: regenerate ? "REGENERATE" : undefined,
        keyId: regenerate?.keyId,
      }),
    });
    const body = (await response.json()) as { apiKey?: { rawKey: string }; message?: string };
    if (body.apiKey) {
      setRawKey(body.apiKey.rawKey);
      setMessage("Copy this key now. It cannot be viewed again.");
      load();
    } else {
      setMessage(body.message ?? "The key was not created.");
    }
  }

  async function archive() {
    const response = await fetch(`/api/console/organisations/${params.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "archive", confirm: archiveConfirm }),
    });
    const body = (await response.json()) as { ok?: boolean; message?: string };
    if (body.ok) {
      setArchiveConfirm("");
      load();
    } else {
      setMessage(body.message ?? "Archive failed.");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Organisation"
        title={data?.name ?? "App overview"}
        description="API status, providers, spend, privacy, budget and keys for one tenant."
      />
      <QueryState status={loading ? "loading" : error ? "error" : "ready"} message={error} onRetry={load} loadingLabel="Loading organisation">
        {!data ? <PageEmpty title="Organisation not found." detail="Return to the organisations list." /> : (
          <div>
            <div className="mb-6 flex flex-wrap gap-2">
              <StatusBadge label={data.archivedAt ? "Archived" : "Active"} tone={data.archivedAt ? "warn" : "ok"} />
              <StatusBadge label={data.settings.environment} />
              <StatusBadge label={data.settings.fallbackPolicy === "fail_closed" ? "Fail closed" : "Fail open recorded"} tone="ok" />
              <StatusBadge label={data.settings.exactCacheEnabled ? "Exact cache on" : "Cache off"} />
            </div>
            <div className="mb-5 flex flex-wrap gap-2">
              {["Overview", "API keys", "Providers", "Budgets", "Privacy", "Usage", "Recent requests", "Settings"].map((item) => (
                <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-[8px] px-3 py-1.5 text-sm ${tab === item ? "bg-accent/12 font-semibold text-ink ring-1 ring-accent/30" : "text-muted hover:bg-raised hover:text-ink"}`}>
                  {item}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Requests this month" value={String(data.usage.monthRequests)} />
              <Stat label="Spend" value={formatGbp(data.usage.spendMicros, 2)} />
              <Stat label="Savings" value={formatGbp(data.usage.savingsMicros, 2)} />
              <Stat label="Budget" value={formatGbp(data.settings.monthlyBudgetMicros, 0)} />
            </div>
            {tab === "Overview" || tab === "Usage" ? (
              <Panel className="mt-5 p-5 text-sm text-muted">
                <p>Slug {data.settings.slug || "—"} · {data.settings.description || "No description"}</p>
                <p className="mt-2">Archived organisations cannot authenticate new API requests.</p>
                <div className="mt-4 flex gap-3">
                  <Link href="/playground"><Button variant="secondary">Playground</Button></Link>
                  <Link href="/organisations/new"><Button variant="secondary">Create another app</Button></Link>
                </div>
              </Panel>
            ) : null}
            {tab === "API keys" ? (
              <Panel className="mt-5 p-5">
                <p className="text-sm text-amber-800 dark:text-amber-100">Raw keys are shown once and stored as SHA-256 hashes only.</p>
                {rawKey ? <p className="mt-3 break-all rounded-[8px] border border-accent/30 bg-accent/10 p-3 font-mono text-sm">{rawKey}</p> : null}
                <ul className="mt-4 space-y-2 text-sm">
                  {data.keys.map((key) => (
                    <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2">
                      <span>{key.name} · {key.prefix}… {key.revokedAt ? "revoked" : "active"}</span>
                      {!key.revokedAt && !data.archivedAt ? (
                        <Button variant="secondary" onClick={() => void createKey({ keyId: key.id })}>Regenerate</Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {!data.archivedAt ? <Button className="mt-4" onClick={() => void createKey()}>Create API key</Button> : null}
                {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
              </Panel>
            ) : null}
            {tab === "Providers" ? (
              <Panel className="mt-5 p-5 text-sm">
                Preferred: {data.settings.preferredProviders.join(", ") || "none"}
              </Panel>
            ) : null}
            {tab === "Budgets" ? (
              <Panel className="mt-5 p-5 text-sm text-muted">
                Monthly budget {formatGbp(data.settings.monthlyBudgetMicros, 0)}. Warning threshold {formatGbp(data.settings.spikeAlertThresholdMicros, 0)}.
                Exceeding the budget returns 402 and does not contact a provider.
              </Panel>
            ) : null}
            {tab === "Privacy" ? (
              <Panel className="mt-5 p-5 text-sm text-muted">
                PII protection is enabled. Unscreened prompts never reach a provider. Fail-closed remains the enforcement path even if fail-open is recorded.
              </Panel>
            ) : null}
            {tab === "Recent requests" ? (
              <Panel className="mt-5 overflow-x-auto p-2">
                {data.recentRequests.length === 0 ? <p className="p-4 text-sm text-muted">No requests yet.</p> : (
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-raised text-[12px] text-muted">
                      <tr>{["When", "Model", "Cache", "Latency", "Spend", "Savings"].map((heading) => <th key={heading} className="px-3 py-2.5 font-semibold">{heading}</th>)}</tr>
                    </thead>
                    <tbody>
                      {data.recentRequests.map((item) => (
                        <tr key={item.id} className="border-t border-line hover:bg-raised">
                          <td className="px-3 py-2">{formatWhen(item.createdAt)}</td>
                          <td className="px-3 py-2">{item.provider}/{item.model}</td>
                          <td className="px-3 py-2">{item.blocked ? "blocked" : item.cacheStatus}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{item.totalMs} ms</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatGbp(item.actualMicros, 4)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-accent">{formatGbp(item.savingMicros, 4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            ) : null}
            {tab === "Settings" ? (
              <Panel className="mt-5 p-5">
                <p className="text-sm text-muted">Archive stops API keys from authenticating. Type ARCHIVE to confirm.</p>
                {!data.archivedAt ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <input className="field max-w-xs" value={archiveConfirm} onChange={(event) => setArchiveConfirm(event.target.value)} placeholder="ARCHIVE" />
                    <Button variant="danger" onClick={() => void archive()} disabled={archiveConfirm !== "ARCHIVE"}>
                      Archive organisation
                    </Button>
                  </div>
                ) : <p className="mt-3 text-sm">This organisation is archived.</p>}
                {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
              </Panel>
            ) : null}
          </div>
        )}
      </QueryState>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-4">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl tracking-tight">{value}</p>
    </Panel>
  );
}
