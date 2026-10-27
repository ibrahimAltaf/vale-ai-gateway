import { Suspense } from "react";

import { MobileBar, Sidebar } from "@/components/layout/sidebar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-wash text-ink">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <div className="lg:pl-[220px]">
        <Suspense fallback={null}>
          <MobileBar />
        </Suspense>
        <main className="mx-auto w-full max-w-[1180px] px-5 py-6 md:px-8 md:py-8 lg:pl-[8px]">{children}</main>
      </div>
    </div>
  );
}
