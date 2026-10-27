export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[13px] leading-5 text-muted">{children}</p>;
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-[13px] font-semibold text-ink">{children}</span>;
}
