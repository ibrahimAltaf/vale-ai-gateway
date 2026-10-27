import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetConfigForTests } from "@/server/config/env";
import { authenticateAdmin, createSessionToken, readSessionToken } from "@/server/auth/tokens";

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.ADMIN_EMAIL = "admin@vale.local";
  process.env.ADMIN_PASSWORD = "vale-admin-change-me";
  process.env.SESSION_SECRET = "demo-only-session-secret-32chars";
  resetConfigForTests();
});

afterEach(() => {
  resetConfigForTests();
});

describe("console session", () => {
  it("accepts the configured admin and rejects a wrong password", () => {
    const session = authenticateAdmin("admin@vale.local", "vale-admin-change-me");
    expect(session?.role).toBe("admin");
    expect(authenticateAdmin("admin@vale.local", "wrong-password")).toBeNull();
  });

  it("rejects a tampered session token", () => {
    const token = createSessionToken({ email: "admin@vale.local", role: "admin", issuedAt: Date.now() });
    expect(readSessionToken(token)?.email).toBe("admin@vale.local");
    expect(readSessionToken(`${token}x`)).toBeNull();
  });
});
