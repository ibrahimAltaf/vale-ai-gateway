"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageEmpty, QueryState } from "@/components/ui/page-state";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatGbp } from "@/lib/money";
import { readJson } from "@/lib/load-state";

interface OrganisationRow {
  id: string;
  name: string;
  sector: string;
  slug?: string;
  environment?: string;
  archivedAt: string | null;
  monthlyBudgetMicros: number;
  exactCacheEnabled: boolean;
  fallbackPolicy?: string;
  keys: Array<{ id: string; name: string; prefix: string; revokedAt: string | null }>;
}

interface OrganisationsBody {
  ok: true;
  organisations: OrganisationRow[];
}

export function TenantsView() {
  const [rows, setRows] = useState<OrganisationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    void readJson<OrganisationsBody>("/api/console/organisations")
      .then((body) => {
        setRows(body.organisations);
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
        eyebrow="Organisations"
        title="Apps, keys and budgets."
        description="Each organisation is a tenant. Create an app to configure providers, privacy, budget and a one-time API key."
      />
      <div className="mb-6">
        <Link href="/organisations/new">
          <Button>Create app</Button>
        </Link>
      </div>
      <QueryState status={loading ? "loading" : error ? "error" : "ready"} message={error} onRetry={load} loadingLabel="Loading organisations">
        {rows.length === 0 ? (
          <PageEmpty title="No organisations yet." detail="Create an app to receive an API key and start sending requests." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((tenant) => (
              <Link key={tenant.id} href={`/organisations/${tenant.id}`}>
                <Panel className="h-full p-5 transition hover:border-accent/25 hover:bg-raised">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-medium text-muted">{tenant.environment ?? tenant.sector}</p>
                      <h2 className="mt-1.5 text-[20px] font-semibold tracking-tight">{tenant.name}</h2>
                      <p className="mt-1 text-sm text-muted">{tenant.slug || tenant.id}</p>
                    </div>
                    <StatusBadge label={tenant.archivedAt ? "Archived" : "Active"} tone={tenant.archivedAt ? "warn" : "ok"} />
                  </div>
                  <dl className="mt-5 space-y-3 text-sm">
                    <Row label="Budget" value={formatGbp(tenant.monthlyBudgetMicros, 0)} />
                    <Row label="Exact cache" value={tenant.exactCacheEnabled ? "On" : "Off"} />
                    <Row label="Active keys" value={String(tenant.keys.filter((key) => !key.revokedAt).length)} />
                  </dl>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-2">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
