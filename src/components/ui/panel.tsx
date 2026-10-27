import { cn } from "@/lib/cn";

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-[12px] border border-line bg-surface shadow-[var(--shadow)]", className)}>{children}</section>;
}
