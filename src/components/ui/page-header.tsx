export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6 max-w-3xl">
      <p className="text-[12px] font-semibold tracking-[0.06em] text-faint">{eyebrow}</p>
      <h1 className="mt-1.5 text-[30px] font-bold leading-[1.12] tracking-[-0.03em] text-ink md:text-[34px]">{title}</h1>
      <p className="mt-2 text-[15px] leading-6 text-muted">{description}</p>
    </header>
  );
}
