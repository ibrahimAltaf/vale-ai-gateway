import "server-only";

import { cookies } from "next/headers";

import { authenticateAdmin, createSessionToken, readSessionToken, SESSION_MAX_AGE, type ConsoleSession } from "@/server/auth/tokens";

const COOKIE = "vale_session";

export { authenticateAdmin, createSessionToken, readSessionToken, type ConsoleSession };

export async function getConsoleSession(): Promise<ConsoleSession | null> {
  const store = await cookies();
  return readSessionToken(store.get(COOKIE)?.value);
}

export async function writeConsoleSession(session: ConsoleSession): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearConsoleSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
