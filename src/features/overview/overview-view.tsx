"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CountUp } from "@/components/motion/count-up";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/ui/page-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { DashboardCharts } from "@/features/overview/dashboard-charts";
import { FlowVisual } from "@/features/overview/flow-visual";
import { formatClock, formatGbp, formatNumber, formatWhen } from "@/lib/money";
import { readJson, type LoadState } from "@/lib/load-state";
import type { OverviewBody, RequestsBody } from "@/types/api";

export function OverviewView() {
  const [state, setState] = useState<LoadState<OverviewBody>>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    void readJson<OverviewBody>("/api/console/overview")
      .then((data) => setState({ status: "ready", data }))
      .catch((error: Error) => setState({ status: "error", message: error.message }));
  }, []);

  useEffect(() => {
    queueMicrotask(() => load());
  }, [load]);

  const overview = state.status === "ready" ? state.data.overview : undefined;
  const activity = state.status === "ready" ? state.data.charts.activity : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-faint">VALE GATEWAY</p>
          <h1 className="mt-2 text-[36px] font-bold leading-[1.08] tracking-[-0.035em] md:text-[44px]">
            Every AI request. Private, measurable and optimised.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted">
            Vale sits between your applications and the model providers, so spend, privacy and cache results stay visible.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/organisations/new">
            <Button>Create app</Button>
          </Link>
          <Link href="/playground">
            <Button variant="secondary">Run live request</Button>
          </Link>
        </div>
      </div>
      <QueryState status={state.status} message={state.status === "error" ? state.message : undefined} onRetry={load} loadingLabel="Reading the ledger">
        {overview ? (
          <>
            <SystemStatus
              gateway={overview.gatewayOperational}
              privacy={overview.piiProtectionActive}
              isolation={overview.tenantIsolationActive}
            />
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
              <article className="kpi-card kpi-accent-blue flex min-h-[280px] flex-col p-6 lg:col-span-7 lg:row-span-2">
                <p className="text-[13px] font-medium text-muted">Requests today</p>
                <p className="mt-4 text-[48px] font-bold leading-none tracking-tight tabular-nums md:text-[56px]">
                  <CountUp value={overview.requestsToday} format={formatNumber} />
                </p>
                <p className="mt-4 text-[14px] font-medium">{formatNumber(overview.requestsMonth)} this month</p>
                <p className="mt-1 text-[13px] text-muted">AI requests processed today</p>
                <RequestSparkline activity={activity ?? []} />
              </article>
              <article className="kpi-card kpi-accent-teal p-5 lg:col-span-5">
                <p className="text-[13px] font-medium text-muted">Verified savings</p>
                <p className="mt-3 text-[36px] font-bold leading-none tracking-tight text-accent tabular-nums">
                  <CountUp value={overview.estimatedSavingsMicros} format={(value) => formatGbp(value, 2)} />
                </p>
                <p className="mt-3 text-[13px] text-muted">Baseline minus actual provider cost</p>
              </article>
              <article className="kpi-card kpi-accent-indigo p-5 lg:col-span-5">
                <p className="text-[13px] font-medium text-muted">Actual spend</p>
                <p className="mt-3 text-[36px] font-bold leading-none tracking-tight tabular-nums">
                  <CountUp value={overview.actualSpendMicros} format={(value) => formatGbp(value, 2)} />
                </p>
                <p className="mt-3 text-[13px] text-muted">Current AI provider cost</p>
              </article>
              <article className="kpi-card kpi-accent-cyan p-5 lg:col-span-4">
                <p className="text-[13px] font-medium text-muted">Cache hit rate</p>
                <p className="mt-3 text-[36px] font-bold leading-none tracking-tight tabular-nums">
                  <CountUp value={overview.cacheHitRate * 100} format={(value) => `${Math.round(value)}%`} />
                </p>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-raised">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(Math.min(1, Math.max(0, overview.cacheHitRate)) * 100)}%` }} />
                </div>
                <p className="mt-3 text-[13px] text-muted">Exact matches reused</p>
              </article>
              <article className="kpi-card kpi-accent-green p-5 lg:col-span-4">
                <p className="text-[13px] font-medium text-muted">Privacy protection</p>
                <p className="mt-3 text-[36px] font-bold leading-none tracking-tight tabular-nums">
                  <CountUp value={overview.privacyBlocks} format={(value) => `${formatNumber(value)} blocked`} />
                </p>
                <p className="mt-3 text-[13px] text-muted">{overview.piiProtectionActive ? "Fail-closed active" : "Privacy service unavailable"}</p>
              </article>
              <article className="kpi-card kpi-accent-neutral p-5 lg:col-span-4">
                <p className="text-[13px] font-medium text-muted">Active apps</p>
                <p className="mt-3 text-[36px] font-bold leading-none tracking-tight tabular-nums">
                  <CountUp value={overview.activeOrganisations} format={formatNumber} />
                </p>
                <p className="mt-3 text-[13px] text-muted">
                  {overview.gatewayOperational && overview.piiProtectionActive && overview.tenantIsolationActive && overview.activeOrganisations > 0
                    ? "All operational"
                    : "Connected organisations"}
                </p>
              </article>
            </div>
            {state.status === "ready" ? <DashboardCharts charts={state.data.charts} /> : null}
            <RecentRequests />
            <div className="mt-4">
              <FlowVisual />
            </div>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}

function SystemStatus({ gateway, privacy, isolation }: { gateway: boolean; privacy: boolean; isolation: boolean }) {
  return (
    <section className="kpi-card mt-5 px-5 py-3.5">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-faint">SYSTEM STATUS</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <StatusCell label="Gateway" value={gateway ? "Operational" : "Degraded"} ok={gateway} />
        <StatusCell label="Privacy" value={privacy ? "Protected" : "Unavailable"} ok={privacy} />
        <StatusCell label="Tenant isolation" value={isolation ? "Active" : "Inactive"} ok={isolation} />
      </div>
    </section>
  );
}

function StatusCell({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  const Icon = ok ? CheckCircle2 : CircleAlert;
  return (
    <div>
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-semibold">
        <Icon size={15} strokeWidth={1.75} className={ok ? "text-accent" : "text-red-400"} />
        {value}
      </p>
    </div>
  );
}

function RequestSparkline({ activity }: { activity: Array<{ month: string; requests: number }> }) {
  if (activity.length < 2 || activity.every((item) => item.requests === 0)) return <div className="mt-auto" />;
  const max = Math.max(...activity.map((item) => item.requests), 1);
  const width = 280;
  const height = 48;
  const points = activity.map((item, index) => {
    const x = (index / (activity.length - 1)) * width;
    const y = height - (item.requests / max) * (height - 8) - 4;
    return `${x},${y}`;
  });
  return (
    <svg className="mt-auto w-full max-w-[280px] text-accent" viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.75" points={points.join(" ")} />
    </svg>
  );
}

function RecentRequests() {
  const [rows, setRows] = useState<RequestsBody | null>(null);

  useEffect(() => {
    void fetch("/api/console/requests?page=1")
      .then((response) => response.json())
      .then((body: RequestsBody) => {
        if (body.ok) setRows(body);
      });
  }, []);

  return (
    <section className="kpi-card mt-4 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-[18px] font-semibold">Recent AI requests</h2>
        <Link href="/requests" className="text-[13px] font-semibold text-accent">
          View all requests →
        </Link>
      </div>
      {!rows || rows.requests.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted">No requests yet. Send one from the playground to populate this table.</p>
      ) : (
        <table className="w-full text-left text-[13px]">
          <thead className="bg-raised text-muted">
            <tr>
              {["Time", "App", "Model", "Status", "Latency", "Cost", "Cache"].map((heading) => (
                <th key={heading} className="px-5 py-2 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.requests.slice(0, 5).map((item) => (
              <tr key={item.id} className="border-t border-line hover:bg-raised">
                <td className="px-5 py-2.5 tabular-nums text-muted" title={formatWhen(item.createdAt)}>
                  {formatClock(item.createdAt)}
                </td>
                <td className="px-5 py-2.5">{item.organisation}</td>
                <td className="px-5 py-2.5">{item.model}</td>
                <td className="px-5 py-2.5">
                  <StatusBadge label={item.blocked ? "Blocked" : "Success"} tone={item.blocked ? "bad" : "ok"} />
                </td>
                <td className="px-5 py-2.5 tabular-nums">{item.totalMs}ms</td>
                <td className="px-5 py-2.5 tabular-nums">{formatGbp(item.actualMicros, 4)}</td>
                <td className="px-5 py-2.5 capitalize text-muted">{item.cacheStatus === "hit" ? "Cache hit" : item.cacheStatus === "miss" ? "Cache miss" : item.cacheStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
