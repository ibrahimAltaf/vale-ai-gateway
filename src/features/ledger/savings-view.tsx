"use client";

import { useCallback, useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/ui/page-header";
import { QueryState } from "@/components/ui/page-state";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatGbp, formatPercent, formatWhen } from "@/lib/money";
import type { LedgerBody } from "@/types/api";

export function SavingsView() {
  const [data, setData] = useState<LedgerBody | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    void fetch("/api/console/ledger")
      .then(async (response) => {
        const body = (await response.json()) as LedgerBody & { message?: string };
        if (!response.ok || !body.ok) throw new Error(body.message ?? "The ledger could not be loaded.");
        setData(body);
        setLoading(false);
      })
      .catch((caught: Error) => {
        setError(caught.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    queueMicrotask(() => load());
  }, [load]);

  return (
    <div>
      <PageHeader
        eyebrow="Savings"
        title="Verified gateway savings."
        description="Vale measures real spend avoided from exact cache and batch pricing. Semantic cache and routing stay planned and are not invented."
      />
      <QueryState status={loading ? "loading" : error ? "error" : "ready"} message={error} onRetry={load} loadingLabel="Reading the ledger">
        {data ? <SavingsBody data={data} /> : null}
      </QueryState>
    </div>
  );
}

function SavingsBody({ data }: { data: LedgerBody }) {
  const chart = data.months.map((month) => ({ month: month.month, savings: month.savingsMicros / 1_000_000 }));
  const empty = data.entries.length === 0;

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-4">
        <Card label="Baseline spend" value={formatGbp(data.baselineMicros, 2)} hint="What the same work would have cost at list price." />
        <Card label="Actual spend" value={formatGbp(data.actualMicros, 2)} hint="What was paid after Vale processed the request." />
        <Card label="Verified savings" value={formatGbp(data.savingsMicros, 2)} hint="Baseline minus actual. Posted ledger only." accent />
        <Card label="Savings rate" value={formatPercent(data.savingsRate)} hint="Verified savings as a share of baseline." />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {data.breakdown.map((item) => (
          <Card key={item.reason} label={item.label} value={formatGbp(item.amountMicros, 2)} hint="Calculated from completed requests." />
        ))}
        {(data.planned ?? []).map((item) => (
          <Panel key={item.reason} className="p-4">
            <p className="text-[13px] font-medium text-muted">{item.label}</p>
            <p className="mt-2 text-lg text-muted">—</p>
            <div className="mt-3">
              <StatusBadge label="Planned — not calculated" tone="planned" />
            </div>
          </Panel>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">{data.exclusionNote}</p>
      <Panel className="mt-5 p-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium">Savings over time</h2>
            <p className="mt-1 text-[13px] text-muted">Posted gateway savings in GBP. Empty until a request is persisted.</p>
          </div>
        </div>
        {empty || chart.length === 0 ? (
          <div className="grid h-52 place-items-center rounded-[10px] border border-dashed border-line bg-raised">
            <p className="max-w-md text-center text-sm leading-6 text-muted">
              No savings series yet. Send a playground or API request that hits exact cache, then this chart will use the ledger — not placeholder data.
            </p>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `£${value}`} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--ink)" }}
                  formatter={(value) => [`£${Number(value).toFixed(2)}`, "Savings"]}
                />
                <Area type="monotone" dataKey="savings" stroke="var(--accent)" fill="color-mix(in srgb, var(--accent) 18%, transparent)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
      <Panel className="mt-5 overflow-x-auto">
        {empty ? (
          <p className="p-5 text-sm text-muted">Ledger rows appear here after a completed or cached request.</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-raised text-[12px] text-muted">
              <tr>
                {["Date", "App", "Provider", "Model", "Baseline", "Actual", "Saving", "Reason"].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => (
                <tr key={entry.id} className="border-t border-line hover:bg-raised">
                  <td className="px-4 py-3 text-muted">{formatWhen(entry.createdAt)}</td>
                  <td className="px-4 py-3">{entry.organisation}</td>
                  <td className="px-4 py-3 capitalize">{entry.provider}</td>
                  <td className="px-4 py-3">{entry.model}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatGbp(entry.baselineMicros, 2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatGbp(entry.actualMicros, 2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent">{formatGbp(entry.gatewaySavingMicros, 2)}</td>
                  <td className="px-4 py-3 capitalize">{entry.reason.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function Card({ label, value, hint, accent = false }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <Panel className="p-4">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className={`mt-1.5 text-[30px] font-semibold tracking-tight ${accent ? "text-accent" : "text-ink"}`}>{value}</p>
      <p className="mt-2 text-[13px] leading-5 text-muted">{hint}</p>
    </Panel>
  );
}
