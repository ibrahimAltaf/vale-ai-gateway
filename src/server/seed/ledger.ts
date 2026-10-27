import type { SavingsEntry } from "@/types/domain";

const PENCE = 10_000;

interface SeedLine {
  id: string;
  tenantId: string;
  createdAt: string;
  provider: SavingsEntry["provider"];
  model: string;
  reason: SavingsEntry["reason"];
  baselineMicros: number;
  actualMicros: number;
  gatewaySavingMicros: number;
  inputTokens: number;
  outputTokens: number;
}

const LINES: SeedLine[] = [
  line("led_ns_exact_1", "ten_northstar", "2026-10-03T09:10:00.000Z", "openai", "gpt-4o", "exact_cache", 15000, 0, 15000, 820000, 210000),
  line("led_ns_exact_2", "ten_northstar", "2026-10-08T11:24:00.000Z", "openai", "gpt-4o-mini", "exact_cache", 9800, 0, 9800, 1400000, 360000),
  line("led_ns_sem", "ten_northstar", "2026-10-11T14:02:00.000Z", "anthropic", "claude-sonnet-4.5", "semantic_cache", 11200, 0, 11200, 260000, 90000),
  line("led_ns_model", "ten_northstar", "2026-10-16T10:18:00.000Z", "openai", "gpt-4o-mini", "model_routing", 94200, 80000, 14200, 2100000, 640000),
  line("led_ns_batch", "ten_northstar", "2026-10-22T16:41:00.000Z", "google", "gemini-2.5-flash", "batch", 73800, 62800, 11000, 3200000, 800000),
  line("led_ac_exact", "ten_acme", "2026-10-04T08:12:00.000Z", "anthropic", "claude-haiku-4.5", "exact_cache", 8400, 0, 8400, 540000, 120000),
  line("led_ac_sem", "ten_acme", "2026-10-09T13:33:00.000Z", "openai", "gpt-4o", "semantic_cache", 6200, 0, 6200, 180000, 40000),
  line("led_ac_model", "ten_acme", "2026-10-18T09:47:00.000Z", "google", "gemini-2.5-flash", "model_routing", 22122, 18000, 4122, 900000, 220000),
  line("led_ac_batch", "ten_acme", "2026-10-24T15:05:00.000Z", "openai", "gpt-4o-mini", "batch", 33316, 30616, 2700, 1600000, 410000),
  line("led_fe_exact", "ten_finedge", "2026-10-06T07:55:00.000Z", "google", "gemini-2.5-pro", "exact_cache", 15018, 0, 15018, 430000, 110000),
  line("led_fe_sem", "ten_finedge", "2026-10-13T12:20:00.000Z", "anthropic", "claude-sonnet-4.5", "semantic_cache", 14042, 0, 14042, 310000, 80000),
  line("led_fe_model", "ten_finedge", "2026-10-20T17:14:00.000Z", "openai", "gpt-4o-mini", "model_routing", 72589, 62000, 10589, 2500000, 700000),
  line("led_fe_batch", "ten_finedge", "2026-10-26T18:02:00.000Z", "anthropic", "claude-haiku-4.5", "batch", 45993, 38000, 7993, 1800000, 460000),
];

export const SEEDED_LEDGER: SavingsEntry[] = LINES.map((entry) => ({
  ...entry,
  requestId: entry.id.replace("led_", "req_batch_"),
  pricingVersion: "2026-04-01",
  providerNativeDiscountMicros: 0,
}));

export const HISTORICAL_MONTHS = [
  { month: "May", savingsMicros: 42000 * PENCE },
  { month: "Jun", savingsMicros: 51000 * PENCE },
  { month: "Jul", savingsMicros: 64000 * PENCE },
  { month: "Aug", savingsMicros: 78000 * PENCE },
  { month: "Sep", savingsMicros: 96000 * PENCE },
];

function line(
  id: string,
  tenantId: string,
  createdAt: string,
  provider: SavingsEntry["provider"],
  model: string,
  reason: SavingsEntry["reason"],
  baselineMicros: number,
  actualMicros: number,
  gatewaySavingMicros: number,
  inputTokens: number,
  outputTokens: number,
): SeedLine {
  return {
    id,
    tenantId,
    createdAt,
    provider,
    model,
    reason,
    baselineMicros: baselineMicros * PENCE,
    actualMicros: actualMicros * PENCE,
    gatewaySavingMicros: gatewaySavingMicros * PENCE,
    inputTokens,
    outputTokens,
  };
}
