"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DemoNotice } from "@/components/brand/demo-notice";
import { Mark } from "@/components/brand/mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/hint";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await response.json()) as { ok?: boolean; message?: string };
    setPending(false);
    if (!response.ok || !body.ok) {
      setError(body.message ?? "Sign-in failed.");
      return;
    }
    const next = search.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <div className="app-wash grid place-items-center px-5">
      <div className="absolute right-4 top-4 w-40">
        <ThemeToggle />
      </div>
      <form onSubmit={(event) => void submit(event)} className="kpi-card w-full max-w-md p-8">
        <Mark className="h-9 w-9 text-ink" />
        <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Vale console</p>
        <h1 className="mt-2 text-[30px] font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-muted">The operator console is restricted to authenticated administrators.</p>
        <label className="mt-6 block">
          <FieldLabel>Email</FieldLabel>
          <input className="field mt-1.5" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="mt-4 block">
          <FieldLabel>Password</FieldLabel>
          <input className="field mt-1.5" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error ? <p className="mt-4 text-sm text-red-600 dark:text-red-200">{error}</p> : null}
        <Button className="mt-6 w-full" disabled={pending}>
          {pending ? "Signing in" : "Sign in"}
        </Button>
        <div className="mt-5">
          <DemoNotice />
        </div>
      </form>
    </div>
  );
}
