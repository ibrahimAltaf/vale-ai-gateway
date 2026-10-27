export function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-[8px] border border-line bg-raised px-3 py-2.5 text-left text-sm"
    >
      <span>{label}</span>
      <span className={`relative h-6 w-10 rounded-full p-0.5 ${checked ? "bg-accent" : "bg-line"}`}>
        <span className={`block h-5 w-5 rounded-full bg-surface shadow-sm transition ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
