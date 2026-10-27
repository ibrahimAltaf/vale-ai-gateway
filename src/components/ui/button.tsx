import { cn } from "@/lib/cn";

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-4 text-[14px] font-semibold transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "bg-[linear-gradient(180deg,color-mix(in_srgb,#fff_18%,var(--accent)),var(--accent))] text-accent-ink shadow-[0_1px_2px_rgba(2,8,20,0.22)] hover:brightness-110",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-raised",
        variant === "ghost" && "text-muted hover:bg-raised hover:text-ink",
        variant === "danger" && "border border-red-400/30 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-100",
        className,
      )}
      {...props}
    />
  );
}
