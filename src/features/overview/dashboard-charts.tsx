"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { StatusBadge } from "@/components/ui/status-badge";
import { formatGbp, formatGbpAxis, formatNumber } from "@/lib/money";

export interface DashboardChartsData {
  months: Array<{ month: string; savingsMicros: number }>;
  activity?: Array<{ month: string; requests: number; spendMicros: number; savingsMicros: number }>;
  breakdown: Array<{ label: string; amountMicros: number }>;
  planned?: Array<{ label: string }>;
  tenants: Array<{ name: string; spendMicros: number; savingsMicros: number }>;
  providers?: Array<{ name: string; count: number }>;
  models?: Array<{ name: string; count: number }>;
  cache?: Array<{ name: string; count: number }>;
}

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  color: "var(--ink)",
};
const axis = "var(--muted)";
const grid = "var(--line)";

export function DashboardCharts({ charts }: { charts: DashboardChartsData }) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-12">
      <ActivityChart charts={charts} />
      <SavingsBreakdown charts={charts} />
    </div>
  );
}

function ActivityChart({ charts }: { charts: DashboardChartsData }) {
  const activity = charts.activity ?? charts.months.map((item) => ({ month: item.month, requests: 0, spendMicros: 0, savingsMicros: item.savingsMicros }));
  const money = activity.map((item) => ({
    month: item.month,
    spend: item.spendMicros / 1_000_000,
    savings: item.savingsMicros / 1_000_000,
    requests: item.requests,
  }));
  const maxMoney = Math.max(0, ...money.map((item) => Math.max(item.spend, item.savings)));
  const maxRequests = Math.max(0, ...money.map((item) => item.requests));
  const enoughMoney = money.length >= 2 && maxMoney > 0;
  const enoughRequests = money.length >= 2 && maxRequests > 0;

  return (
    <section className="kpi-card p-5 lg:col-span-8">
      <h2 className="text-[18px] font-semibold">{enoughMoney ? "Spend and savings" : "Request activity"}</h2>
      <p className="mt-1 text-[13px] text-muted">
        {enoughMoney ? "Posted provider cost against verified gateway savings." : "Completed and blocked requests, by month."}
      </p>
      {!enoughMoney && !enoughRequests ? (
        <div className="relative mt-5 grid h-48 place-items-center overflow-hidden rounded-[10px] bg-raised">
          <div className="pointer-events-none absolute inset-x-6 inset-y-8 border-b border-l border-line/70" />
          <div className="relative px-6 text-center">
            <p className="text-[15px] font-semibold">Not enough activity yet</p>
            <p className="mt-1.5 max-w-sm text-[13px] leading-5 text-muted">More request activity is needed to build this trend.</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={money} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="month" stroke={axis} fontSize={12} tickLine={false} axisLine={false} />
              {enoughMoney ? (
                <YAxis stroke={axis} fontSize={12} tickLine={false} axisLine={false} width={56} tickFormatter={(value) => formatGbpAxis(Number(value))} />
              ) : (
                <YAxis stroke={axis} fontSize={12} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
              )}
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => {
                  if (name === "requests") return [formatNumber(Number(value)), "Requests"];
                  return [formatGbpAxis(Number(value)), name === "spend" ? "Spend" : "Savings"];
                }}
              />
              {enoughMoney ? (
                <>
                  <Area type="monotone" dataKey="spend" stroke="color-mix(in srgb, var(--muted) 80%, #818cf8)" fill="color-mix(in srgb, var(--muted) 16%, transparent)" strokeWidth={2} />
                  <Area type="monotone" dataKey="savings" stroke="var(--accent)" fill="color-mix(in srgb, var(--accent) 14%, transparent)" strokeWidth={2} />
                </>
              ) : (
                <Area type="monotone" dataKey="requests" stroke="var(--accent)" fill="color-mix(in srgb, var(--accent) 14%, transparent)" strokeWidth={2} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function SavingsBreakdown({ charts }: { charts: DashboardChartsData }) {
  const planned = charts.planned ?? [{ label: "Semantic cache" }, { label: "Routing savings" }];

  return (
    <section className="kpi-card p-5 lg:col-span-4">
      <h2 className="text-[18px] font-semibold">Where savings come from</h2>
      <p className="mt-1 text-[13px] text-muted">Verified ledger amounts only.</p>
      <ul className="mt-5 space-y-4">
        {charts.breakdown.map((item) => {
          const visible = formatGbp(item.amountMicros, 2) !== formatGbp(0, 2);
          const total = charts.breakdown.reduce((sum, row) => sum + (formatGbp(row.amountMicros, 2) !== formatGbp(0, 2) ? row.amountMicros : 0), 0);
          const share = visible && total > 0 ? item.amountMicros / total : 0;
          return (
            <li key={item.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px]">{item.label.replace(" savings", "")}</span>
                <span className="text-[14px] tabular-nums text-muted">{formatGbp(item.amountMicros, 2)}</span>
              </div>
              {visible ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-raised">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(8, Math.round(share * 100))}%` }} />
                </div>
              ) : null}
            </li>
          );
        })}
        {planned.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3">
            <span className="text-[14px] text-muted">{item.label.replace("Planned ", "")}</span>
            <StatusBadge label="Planned" tone="planned" />
          </li>
        ))}
      </ul>
    </section>
  );
}
