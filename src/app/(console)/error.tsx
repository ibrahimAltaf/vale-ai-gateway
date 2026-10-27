"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-lg rounded-[12px] border border-line bg-surface p-8">
      <h1 className="text-3xl tracking-tight">This screen could not be shown.</h1>
      <p className="mt-3 text-sm leading-6 text-muted">The gateway console hit an unexpected error. You can try the view again.</p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
