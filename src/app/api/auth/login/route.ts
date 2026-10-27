import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, requestIdFrom } from "@/server/api/http";
import { loginAllowed } from "@/server/auth/login-limit";
import { authenticateAdmin, createSessionToken, SESSION_MAX_AGE } from "@/server/auth/tokens";
import { InvalidRequestError } from "@/server/domain/errors";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!loginAllowed(key)) {
    return errorResponse(new InvalidRequestError(requestId, "Too many sign-in attempts. Try again shortly."), requestId);
  }
  const body = schema.parse(await request.json());
  const session = authenticateAdmin(body.email, body.password);
  if (!session) return errorResponse(new InvalidRequestError(requestId, "Those credentials were not accepted."), requestId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("vale_session", createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
