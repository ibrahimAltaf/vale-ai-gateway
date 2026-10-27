"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import type { PrivacyInspectBody } from "@/types/api";

const SAMPLE =
  "Patient John Smith, NHS 943 476 5919, NI AB 12 34 56 C, born 14 March 1982. Email john.smith@example.com, phone 07700 900123, postcode SW1A 1AA.";

export function Inspector() {
  const [text, setText] = useState(SAMPLE);
  const [result, setResult] = useState<PrivacyInspectBody | null>(null);
  const [pending, setPending] = useState(false);

  async function inspect() {
    setPending(true);
    try {
      const response = await fetch("/api/console/privacy/inspect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setResult((await response.json()) as PrivacyInspectBody);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Privacy"
        title="See what leaves the building."
        description="NHS numbers are checked with modulus 11. Everything recognised is tokenised before a provider can be called."
      />
      <Panel className="p-5">
        <textarea className="field min-h-36 resize-y leading-6" value={text} onChange={(event) => setText(event.target.value)} />
        <Button className="mt-4" onClick={() => void inspect()} disabled={pending}>
          {pending ? "Inspecting" : "Inspect text"}
        </Button>
      </Panel>
      {result?.ok ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Panel className="p-5">
            <p className="text-[13px] font-semibold text-muted">Before</p>
            <Highlighted text={text} entities={result.entities} />
          </Panel>
          <Panel className="p-5">
            <p className="text-[13px] font-semibold text-muted">After</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{result.masked}</p>
          </Panel>
          {result.nhs.map((item) => (
            <Panel key={item.value} className="p-5 lg:col-span-2">
              <div className="grid gap-4 sm:grid-cols-4">
                <Fact label="NHS number" value={item.value} />
                <Fact label="Checksum" value={item.checksum} />
                <Fact label="Method" value={item.method} />
                <Fact label="Status" value={item.status} />
              </div>
            </Panel>
          ))}
        </div>
      ) : null}
      <Panel className="mt-6 grid gap-4 p-5 sm:grid-cols-3">
        <Fact label="Test prompts" value="52" />
        <Fact label="Passed" value="51" />
        <Fact label="Protection rate" value="98.1%" />
      </Panel>
      <p className="mt-3 text-[13px] text-muted">The suite totals are seeded demonstration results, separate from the unit tests in this repository.</p>
    </div>
  );
}

function Highlighted({ text, entities }: { text: string; entities: PrivacyInspectBody["entities"] }) {
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  entities.forEach((entity, index) => {
    pieces.push(text.slice(cursor, entity.start));
    pieces.push(
      <mark key={`${entity.token}-${index}`} className="rounded bg-accent/15 px-1 text-ink">
        {text.slice(entity.start, entity.end)}
      </mark>,
    );
    cursor = entity.end;
  });
  pieces.push(text.slice(cursor));
  return <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{pieces}</p>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-2 text-lg">{value}</p>
    </div>
  );
}
