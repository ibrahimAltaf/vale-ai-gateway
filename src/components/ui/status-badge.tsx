import { cn } from "@/lib/cn";

type Tone = "ok" | "warn" | "bad" | "planned" | "neutral";

const TONE: Record<Tone, string> = {
  ok: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-200",
  warn: "bg-amber-500/12 text-amber-800 ring-amber-500/20 dark:text-amber-100",
  bad: "bg-red-500/12 text-red-700 ring-red-500/20 dark:text-red-200",
  planned: "bg-sky-500/12 text-sky-800 ring-sky-500/20 dark:text-sky-100",
  neutral: "bg-raised text-muted ring-line",
};

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium ring-1", TONE[tone])}>
      {label}
    </span>
  );
}

export function toneForHealth(status: string): Tone {
  if (status === "healthy" || status === "operational") return "ok";
  if (status === "not_configured" || status === "degraded") return "warn";
  if (status === "unavailable") return "bad";
  if (status === "planned") return "planned";
  return "neutral";
}
