"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Boxes, Cpu, ShieldCheck, Wallet, Waypoints } from "lucide-react";
import { useEffect, useState } from "react";

const STEPS = [
  { label: "Client app", detail: "Your application sends an AI request", icon: Boxes },
  { label: "Vale Gateway", detail: "Routes and controls the request", icon: Waypoints },
  { label: "Privacy protection", detail: "Detects and masks sensitive data", icon: ShieldCheck },
  { label: "Cache & cost", detail: "Avoids unnecessary AI spend", icon: Wallet },
  { label: "AI provider", detail: "Sends the safe request to the selected model", icon: Cpu },
];

export function FlowVisual() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % STEPS.length), 1800);
    return () => window.clearInterval(timer);
  }, [reduce]);

  return (
    <div className="kpi-card p-5">
      <h2 className="text-[18px] font-semibold">How an AI request travels</h2>
      <p className="mt-1 text-[13px] leading-5 text-muted">Your app → Vale → privacy → cache → OpenAI, Anthropic or Google.</p>
      <ol className="mt-4 grid gap-2 md:grid-cols-5">
        {STEPS.map((item, index) => {
          const active = index === step;
          const Icon = item.icon;
          return (
            <li key={item.label} className="relative">
              <div className={`rounded-[10px] border px-3 py-3 ${active ? "border-accent/30 bg-accent/10" : "border-line bg-raised"}`}>
                <div className="flex items-center gap-2">
                  <Icon size={16} strokeWidth={1.6} className={active ? "text-accent" : "text-muted"} />
                  <p className="text-[14px] font-semibold">{item.label}</p>
                </div>
                <p className="mt-1.5 text-[13px] leading-5 text-muted">{item.detail}</p>
              </div>
              {index < STEPS.length - 1 ? <ArrowRight size={14} className="absolute top-6 -right-1.5 hidden text-muted md:block" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 rounded-[8px] border border-line bg-input px-4 py-3">
        <p className="text-[12px] font-medium text-muted">Privacy example</p>
        <AnimatePresence mode="wait">
          <motion.p key={step >= 2 ? "masked" : "raw"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-1 text-sm">
            {step >= 2
              ? "The provider receives placeholders such as <NHS_1>. The original identifier never leaves Vale."
              : "Sensitive values stay inside Vale until they are replaced with placeholders."}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
