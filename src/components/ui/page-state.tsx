import { PageLoader } from "@/components/ui/page-loader";
import { Button } from "@/components/ui/button";

export function PageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[12px] border border-red-400/20 bg-red-500/5 px-5 py-7" role="alert">
      <p className="text-lg font-semibold">This page could not be loaded.</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{message}</p>
      <Button className="mt-5" variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function PageEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface px-5 py-7">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{detail}</p>
    </div>
  );
}

export function QueryState({
  status,
  message,
  onRetry,
  loadingLabel,
  children,
}: {
  status: "loading" | "error" | "ready";
  message?: string;
  onRetry: () => void;
  loadingLabel: string;
  children: React.ReactNode;
}) {
  if (status === "loading") return <PageLoader label={loadingLabel} />;
  if (status === "error") return <PageError message={message ?? "Something went wrong."} onRetry={onRetry} />;
  return <>{children}</>;
}
