"use client";

import { useEffect, useState } from "react";

import { MODELS, PROVIDER_LABELS } from "@/data/catalogue";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { QueryState } from "@/components/ui/page-state";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { SettingsBody } from "@/types/api";

export function SettingsView() {
  const [tenantId, setTenantId] = useState("");
  const [organisations, setOrganisations] = useState<Array<{ id: string; name: string }>>([]);
  const [settings, setSettings] = useState<SettingsBody["settings"] | null>(null);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const tenant = organisations.find((item) => item.id === tenantId);

  useEffect(() => {
    void fetch("/api/console/catalogue")
      .then((response) => response.json())
      .then((body: { tenants?: Array<{ id: string; name: string }> }) => {
        if (!body.tenants?.length) return;
        setOrganisations(body.tenants);
        setTenantId((current) => current || body.tenants![0].id);
      });
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    void fetch(`/api/console/organisations/${tenantId}`)
      .then((response) => response.json())
      .then((body: SettingsBody) => {
        if (body.settings) setSettings(body.settings);
      });
  }, [tenantId]);

  async function save(next: SettingsBody["settings"]) {
    if (!tenantId) return;
    const response = await fetch(`/api/console/organisations/${tenantId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "settings", settings: { ...next, semanticCacheEnabled: false } }),
    });
    const body = (await response.json()) as SettingsBody | { message?: string; ok: false };
    if ("settings" in body) {
      setSettings(body.settings);
      setMessage("Saved for this organisation.");
    } else {
      setMessage(body.message ?? "Settings were not saved.");
    }
  }

  if (!settings || !tenant) {
    return (
      <div>
        <PageHeader eyebrow="Settings" title="Organisation policy." description="Budgets, cache and fail-closed policy for one organisation." />
        <QueryState status="loading" onRetry={() => undefined} loadingLabel="Loading policy">
          {null}
        </QueryState>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Organisation policy."
        description="Fail closed stays the behaviour that can reach a provider. Recording fail open does not create a bypass."
      />
      <Panel className="space-y-5 p-5">
        <Select
          label="Organisation"
          value={tenantId}
          onChange={setTenantId}
          options={organisations.map((item) => ({ value: item.id, label: item.name }))}
        />
        <NumberField
          label="Monthly AI budget (£)"
          value={settings.monthlyBudgetMicros / 1_000_000}
          onChange={(value) => setSettings({ ...settings, monthlyBudgetMicros: Math.round(value * 1_000_000) })}
        />
        <NumberField
          label="Daily request limit"
          value={settings.dailyRequestLimit}
          onChange={(value) => setSettings({ ...settings, dailyRequestLimit: Math.round(value) })}
        />
        <NumberField
          label="Spike alert threshold (£)"
          value={settings.spikeAlertThresholdMicros / 1_000_000}
          onChange={(value) => setSettings({ ...settings, spikeAlertThresholdMicros: Math.round(value * 1_000_000) })}
        />
        <NumberField
          label="Per-request maximum (£)"
          value={settings.perRequestMaxMicros / 1_000_000}
          onChange={(value) => setSettings({ ...settings, perRequestMaxMicros: Math.round(value * 1_000_000) })}
        />
        <NumberField
          label="Exact cache TTL (seconds)"
          value={settings.cacheTtlSeconds}
          onChange={(value) => setSettings({ ...settings, cacheTtlSeconds: Math.round(value) })}
        />
        <Switch
          label="Exact cache"
          checked={settings.exactCacheEnabled}
          onChange={(checked) => setSettings({ ...settings, exactCacheEnabled: checked })}
        />
        <p className="rounded-[8px] border border-line bg-raised px-3 py-2.5 text-sm text-muted">Semantic cache is planned and stays off. Exact cache is the live matcher.</p>
        <Switch
          label="Batch eligibility default"
          checked={settings.batchEligibilityDefault}
          onChange={(checked) => setSettings({ ...settings, batchEligibilityDefault: checked })}
        />
        <div>
          <p className="text-[13px] font-semibold">Fallback policy</p>
          <p className="mt-2 text-sm text-muted">
            Current: {settings.fallbackPolicy === "fail_closed" ? "Fail closed" : "Fail open recorded, still blocked when unscreened"}.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => {
              if (settings.fallbackPolicy === "fail_closed") setConfirmOpen(true);
              else void save({ ...settings, fallbackPolicy: "fail_closed" });
            }}
          >
            {settings.fallbackPolicy === "fail_closed" ? "Review fail open" : "Return to fail closed"}
          </Button>
        </div>
        <Select
          label="Fallback model"
          value={settings.fallbackModel}
          onChange={(value) => setSettings({ ...settings, fallbackModel: value })}
          options={MODELS.map((model) => ({
            value: model.id,
            label: `${PROVIDER_LABELS[model.provider]} / ${model.label}`,
          }))}
        />
        <Button onClick={() => void save(settings)}>Save settings</Button>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
      </Panel>
      {confirmOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-labelledby="fail-open-title">
          <Panel className="max-w-lg p-6">
            <h2 id="fail-open-title" className="text-2xl tracking-tight">
              This does not open a bypass.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Fail open would normally mean sending a prompt when privacy screening is unavailable. Vale records the preference and still refuses unscreened traffic. Sensitive content cannot silently reach a provider.
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmOpen(false);
                  void save({ ...settings, fallbackPolicy: "fail_open" });
                }}
              >
                Record fail open
              </Button>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                Keep fail closed
              </Button>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold">{label}</span>
      <input
        className="field mt-1.5"
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

