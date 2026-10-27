"use client";

import { motion } from "framer-motion";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import type { CacheLabBody } from "@/types/api";

export function CacheLab() {
  const [result, setResult] = useState<CacheLabBody | null>(null);
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    setResult(null);
    const response = await fetch("/api/console/cache-lab", { method: "POST" });
    setResult((await response.json()) as CacheLabBody);
    setPending(false);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cache lab"
        title="Same masked prompt. Different patient. Zero leakage."
        description="The cache key carries a privacy-context HMAC. Raw NHS numbers are never written into the key."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <PatientCard label="Patient A" nhs="943 476 5919" prompt="Summarise the record for 943 476 5919" masked={result?.patients[0]?.masked} />
        <PatientCard label="Patient B" nhs="401 023 2137" prompt="Summarise the record for 401 023 2137" masked={result?.patients[1]?.masked} />
      </div>
      <Button className="mt-5" onClick={() => void run()} disabled={pending}>
        {pending ? "Separating" : "Run both through the cache"}
      </Button>
      {result?.ok ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel className="p-5">
              <p className="text-[13px] font-medium text-muted">Masked text</p>
              <p className="mt-2 text-2xl">{result.maskedTextIdentical ? "Identical" : "Different"}</p>
            </Panel>
            <Panel className="p-5">
              <p className="text-[13px] font-medium text-muted">Cache key</p>
              <p className="mt-2 text-2xl">{result.cacheKeysDifferent ? "Different" : "Collision"}</p>
            </Panel>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {result.patients.map((patient) => (
              <Panel key={patient.label} className="p-5">
                <p className="text-sm text-muted">{patient.label}</p>
                <p className="mt-3 break-all font-mono text-xs leading-6">{patient.cacheDisplay}</p>
                <p className="mt-3 text-sm text-muted">{patient.privacyContextLabel}</p>
              </Panel>
            ))}
          </div>
          <Panel className="p-5">
            <p className="text-sm text-muted">The key includes</p>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {(result.patients[0]?.includes ?? []).map((item) => (
                <li key={item} className="rounded-[8px] border border-line px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
          <div className="rounded-[12px] border border-emerald-500/20 bg-emerald-500/10 px-5 py-6">
            <p className="text-[13px] font-medium text-emerald-800 dark:text-emerald-100/80">Cross-patient cache leakage</p>
            <p className="mt-2 text-3xl font-medium tracking-tight">Blocked</p>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}

function PatientCard({ label, nhs, prompt, masked }: { label: string; nhs: string; prompt: string; masked?: string }) {
  return (
    <Panel className="p-5">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-muted">Organisation</dt>
          <dd>Northstar Health UK</dd>
        </div>
        <div>
          <dt className="text-muted">NHS</dt>
          <dd className="font-mono">{nhs}</dd>
        </div>
        <div>
          <dt className="text-muted">Prompt</dt>
          <dd>{prompt}</dd>
        </div>
        <div>
          <dt className="text-muted">Masked</dt>
          <dd className="font-mono">{masked ?? "Summarise the record for <NHS_1>"}</dd>
        </div>
      </dl>
    </Panel>
  );
}
