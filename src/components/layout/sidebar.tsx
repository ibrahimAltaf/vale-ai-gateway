"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { DemoNotice } from "@/components/brand/demo-notice";
import { Mark } from "@/components/brand/mark";
import { NAV } from "@/components/layout/nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/cn";

const GROUPS = ["Operate", "Control", "System"] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="nav-panel fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col border-r border-line px-3 py-5 lg:flex">
      <Brand />
      <Nav pathname={pathname} />
      <div className="mt-auto border-t border-line pt-3">
        <div className="mb-3 px-0.5">
          <DemoNotice compact />
        </div>
        <p className="px-2 pb-1 text-[10px] font-medium tracking-[0.08em] text-faint">ACCOUNT</p>
        <ThemeToggle />
        <SignOut />
      </div>
    </aside>
  );
}

export function MobileBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <Brand compact />
        <button type="button" className="grid h-9 w-9 place-items-center rounded-[8px] border border-line" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen((value) => !value)}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open ? (
        <div className="border-b border-line bg-sidebar px-3 py-3">
          <Nav pathname={pathname} onNavigate={() => setOpen(false)} />
          <div className="my-3">
            <DemoNotice compact />
          </div>
          <ThemeToggle />
          <SignOut />
        </div>
      ) : null}
    </div>
  );
}

function SignOut() {
  return (
    <form action="/api/auth/logout" method="post" className="pt-1">
      <button type="submit" className="w-full rounded-[8px] px-2 py-2 text-left text-[13px] text-muted hover:bg-raised hover:text-ink">
        Sign out
      </button>
    </form>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 px-2", !compact && "mb-6")}>
      <Mark className="h-7 w-7 text-ink" />
      <span>
        <span className="block text-[13px] font-semibold tracking-[0.14em]">VALE</span>
        <span className="block text-[11px] text-muted">AI gateway</span>
      </span>
    </Link>
  );
}

function Nav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-4" aria-label="Primary">
      {GROUPS.map((group) => (
        <div key={group}>
          <p className="px-2 pb-1 text-[10px] font-medium tracking-[0.08em] text-faint">{group.toUpperCase()}</p>
          <div className="flex flex-col gap-0.5">
            {NAV.filter((item) => item.group === group).map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-[13px] text-faint transition hover:bg-raised hover:text-ink",
                    active && "bg-raised font-semibold text-ink",
                  )}
                >
                  <span className={cn("absolute inset-y-1.5 left-0 w-0.5 rounded-full", active ? "bg-accent" : "bg-transparent")} />
                  <Icon size={16} strokeWidth={active ? 1.85 : 1.6} className={active ? "text-accent" : ""} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
