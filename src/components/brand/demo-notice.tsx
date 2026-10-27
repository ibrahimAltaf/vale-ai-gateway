export function DemoNotice({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="rounded-[8px] border border-line bg-raised px-2.5 py-2 text-[11px] leading-4 text-muted">
        Demo build. Core flows work; a large part of the product is still to come.
      </p>
    );
  }

  return (
    <div className="rounded-[10px] border border-line bg-raised px-4 py-3 text-[13px] leading-5 text-muted">
      <p className="font-semibold text-ink">This is a demonstration</p>
      <p className="mt-1">
        The live console shows the current gateway slice only. A substantial amount of product work remains. Please treat
        this as a preview, not a finished platform.
      </p>
    </div>
  );
}
