"use client";

import { motion } from "framer-motion";

import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

const FLOW = [
  "Client application",
  "API key authentication",
  "Tenant resolver",
  "Budget / policy engine",
  "PII detection and tokenisation",
  "Cache engine",
  "LiteLLM routing layer",
  "OpenAI / Anthropic / Google",
  "Response restoration",
  "Savings ledger",
  "Client response",
];

const SIDES = [
  { title: "PostgreSQL", detail: "Tenants, hashed API keys, request metadata, ledger, audit events." },
  { title: "Redis", detail: "Exact cache behind the same CacheStore interface. Memory stands in locally." },
  { title: "CloudWatch", detail: "Structured logs with request id, tenant, provider and latency." },
  { title: "Audit metadata", detail: "Prompt content is never stored in audit logs." },
];

export function ArchitectureView() {
  return (
    <div>
      <PageHeader
        eyebrow="Architecture"
        title="A path the production system can keep."
        description="Route handlers stay thin. Privacy, cache, providers, cost and the ledger are replaceable behind interfaces."
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <ol className="space-y-2">
          {FLOW.map((step, index) => (
            <motion.li
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-[10px] border border-line bg-raised px-4 py-3 text-sm"
            >
              <span className="mr-3 font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
              {step}
            </motion.li>
          ))}
        </ol>
        <div className="space-y-3">
          {SIDES.map((item) => (
            <Panel key={item.title} className="p-5">
              <h2 className="text-lg">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{item.detail}</p>
            </Panel>
          ))}
          <Panel className="p-5">
            <h2 className="text-lg">Tenant boundaries</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Northstar Health UK, Acme Legal and FinEdge UK do not share cache keys, ledger rows or request reads.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
