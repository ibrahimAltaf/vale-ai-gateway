"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import type { QualityReport } from "@/types/api";

const TREE = [
  "src/app/api — thin HTTP adapters",
  "src/server/auth — console session and API key to tenant",
  "src/server/privacy — detect, validate, tokenise, restore",
  "src/server/cache — one key builder, tenant-scoped store",
  "src/server/providers — OpenAI, Anthropic, Google, LiteLLM, demo",
  "src/server/cost — versioned prices and savings attribution",
  "src/server/ledger — posted entries without prompt content",
  "src/server/repositories — interfaces, memory implementation, SQL shape",
  "src/server/gateway — the request pipeline",
];

const PRINCIPLES = [
  "Tenant id comes from the API key, not from an unchecked body field.",
  "Cache, ledger and request reads take a tenant id.",
  "Logs carry metadata. They do not carry prompts, NHS numbers or placeholder maps.",
  "Privacy context is an HMAC. The raw value is not part of the cache key.",
  "If detection is unavailable, the provider is not called.",
  "Provider-native prompt-cache discounts are excluded from gateway savings.",
];

export function EngineeringView() {
  const [report, setReport] = useState<QualityReport | null>(null);

  useEffect(() => {
    void fetch("/api/console/engineering")
      .then((response) => response.json())
      .then((body: { report: QualityReport }) => setReport(body.report));
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Engineering"
        title="The interface sits on a real pipeline."
        description="Indicators below are the last recorded local verification, not a live CI badge and not seed data."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {(report?.commands ?? []).map((command) => (
          <Panel key={command.name} className="flex items-center justify-between p-4">
            <div>
              <p className="text-base">{command.name}</p>
              <p className="mt-1 text-xs text-muted">{command.detail}</p>
            </div>
            <span className="text-xs uppercase tracking-[0.16em]">{command.status}</span>
          </Panel>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">{report?.label}</p>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="text-lg">Repository shape</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {TREE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Panel>
        <Panel className="p-5">
          <h2 className="text-lg">Security principles</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
            {PRINCIPLES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
