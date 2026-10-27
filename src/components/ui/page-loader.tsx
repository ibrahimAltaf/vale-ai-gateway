import { Mark } from "@/components/brand/mark";

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 py-8" role="status" aria-live="polite">
      <Mark className="h-8 w-8 text-ink" />
      <div className="h-px w-36 overflow-hidden bg-line">
        <div className="loader-bar h-full w-1/2 bg-accent" />
      </div>
      <p className="text-[12px] font-medium text-muted">{label}</p>
    </div>
  );
}
