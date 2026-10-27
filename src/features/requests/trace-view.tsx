"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { PageEmpty, QueryState } from "@/components/ui/page-state";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { formatGbp, formatWhen } from "@/lib/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { readJson } from "@/lib/load-state";
import type { RequestDetailBody, RequestsBody } from "@/types/api";

const ALL = "";

export function TraceView() {
  const [tenantId, setTenantId] = useState(ALL);
  const [cacheStatus, setCacheStatus] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<RequestsBody | null>(null);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<RequestDetailBody | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page) });
    if (tenantId) query.set("tenantId", tenantId);
    if (cacheStatus) query.set("cacheStatus", cacheStatus);
    if (status) query.set("status", status);
    void readJson<RequestsBody>(`/api/console/requests?${query}`)
      .then((body) => {
        setList(body);
        setSelected((current) => current || body.requests[0]?.id || "");
        setLoading(false);
      })
      .catch((caught: Error) => {
        setError(caught.message);
        setLoading(false);
      });
  }, [cacheStatus, page, status, tenantId]);

  useEffect(() => {
    queueMicrotask(() => load());
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    void readJson<RequestDetailBody>(`/api/console/requests/${selected}`)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [selected]);

  return (
    <div>
      <PageHeader
        eyebrow="Requests"
        title="A trace for every call."
        description="Timings are metadata. Prompt content, NHS numbers and restoration maps are not written to the trace."
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Select label="Organisation" value={tenantId} onChange={(value) => { setTenantId(value); setPage(1); }} options={[{ value: ALL, label: "All organisations" }, ...(list?.requests ?? []).map((item) => ({ value: item.tenantId, label: item.organisation })).filter((item, index, all) => all.findIndex((entry) => entry.value === item.value) === index)]} />
        <Select label="Cache" value={cacheStatus} onChange={(value) => { setCacheStatus(value); setPage(1); }} options={[{ value: ALL, label: "All cache states" }, { value: "hit", label: "HIT" }, { value: "miss", label: "MISS" }, { value: "bypassed", label: "BYPASS" }, { value: "unavailable", label: "UNAVAILABLE" }]} />
        <Select label="Status" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[{ value: ALL, label: "All statuses" }, { value: "completed", label: "Completed" }, { value: "blocked", label: "Blocked" }]} />
      </div>
      <QueryState status={loading ? "loading" : error ? "error" : "ready"} message={error} onRetry={load} loadingLabel="Loading requests">
        {!list || list.requests.length === 0 ? (
          <PageEmpty title="No requests match these filters." detail="Send a playground request or widen the filters." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <Panel className="max-h-[720px] overflow-auto p-2">
              {list.requests.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item.id)}
                  className={`w-full rounded-[8px] px-4 py-3 text-left transition hover:bg-raised ${selected === item.id ? "bg-raised" : ""}`}
                >
                  <span className="flex items-center justify-between gap-3 text-sm">
                    <span>{item.organisation}</span>
                    <span className="text-muted">{item.totalMs} ms</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {formatWhen(item.createdAt)} · {item.provider}/{item.model} · {item.inputTokens}/{item.outputTokens} tok · {formatGbp(item.actualMicros, 4)}
                  </span>
                  <span className="mt-2 inline-flex gap-2">
                    <StatusBadge label={item.blocked ? item.blockCode ?? "blocked" : "completed"} tone={item.blocked ? "bad" : "ok"} />
                    <StatusBadge label={item.cacheStatus} tone={item.cacheStatus === "hit" ? "ok" : "neutral"} />
                  </span>
                </button>
              ))}
              <div className="mt-3 flex items-center justify-between px-3 text-xs text-muted">
                <span>
                  {list.total} request{list.total === 1 ? "" : "s"}
                </span>
                <span className="flex gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="disabled:opacity-40">
                    Previous
                  </button>
                  <button type="button" disabled={page * list.pageSize >= list.total} onClick={() => setPage((value) => value + 1)} className="disabled:opacity-40">
                    Next
                  </button>
                </span>
              </div>
            </Panel>
            {detail?.ok ? (
              <Panel className="overflow-auto p-6">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Metric label="Total latency" value={`${detail.totalMs} ms`} />
                  <Metric label="Gateway overhead" value={`${detail.gatewayOverheadMs} ms`} />
                  <Metric label="Provider latency" value={`${detail.providerLatencyMs} ms`} />
                  <Metric label="Tokens" value={`${detail.inputTokens}/${detail.outputTokens}`} />
                  <Metric label="Spend" value={formatGbp(detail.actualMicros, 4)} />
                  <Metric label="Savings" value={formatGbp(detail.savingMicros, 4)} />
                </div>
                <ol className="mt-8 space-y-0">
                  {detail.trace.stages.map((stage, index) => (
                    <motion.li
                      key={`${stage.id}-${stage.offsetMs}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="grid grid-cols-[72px_16px_1fr] gap-3"
                    >
                      <span className="pt-1 text-right font-mono text-xs text-muted">{stage.offsetMs} ms</span>
                      <span className="flex flex-col items-center">
                        <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                        {index < detail.trace.stages.length - 1 ? <span className="w-px flex-1 bg-line" /> : null}
                      </span>
                      <div className="pb-6">
                        <p className="text-sm font-medium">{stage.name}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{stage.detail}</p>
                      </div>
                    </motion.li>
                  ))}
                </ol>
                <p className="text-xs text-muted">
                  {detail.organisation} · {detail.provider} · {detail.model} · cache {detail.cacheStatus.toUpperCase()} · {detail.piiEntityCount} PII entities
                  {detail.blocked ? ` · ${detail.blockCode}` : ""}
                </p>
              </Panel>
            ) : null}
          </div>
        )}
      </QueryState>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl tracking-tight">{value}</p>
    </div>
  );
}
