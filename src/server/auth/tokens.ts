import { createHmac, timingSafeEqual } from "node:crypto";

import { getConfig } from "@/server/config/env";
import type { ConsoleRole } from "@/types/domain";

export const SESSION_MAX_AGE = 60 * 60 * 12;

export interface ConsoleSession {
  email: string;
  role: ConsoleRole;
  issuedAt: number;
}

function sessionSecret(): string {
  return getConfig().sessionSecret;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(session: ConsoleSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): ConsoleSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ConsoleSession;
    if (!session.email || session.role !== "admin") return null;
    if (Date.now() - session.issuedAt > SESSION_MAX_AGE * 1000) return null;
    return session;
  } catch {
    return null;
  }
}

export function authenticateAdmin(email: string, password: string): ConsoleSession | null {
  const config = getConfig();
  if (email.trim().toLowerCase() !== config.adminEmail.toLowerCase()) return null;
  const left = Buffer.from(password.padEnd(256, "\0"));
  const right = Buffer.from(config.adminPassword.padEnd(256, "\0"));
  if (!timingSafeEqual(left, right) || password.length !== config.adminPassword.length) return null;
  return { email: config.adminEmail, role: "admin", issuedAt: Date.now() };
}
