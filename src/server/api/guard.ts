import { canViewConsole } from "@/server/auth/roles";
import { getConsoleSession } from "@/server/auth/session";
import type { AppContext } from "@/server/container";
import { InvalidRequestError } from "@/server/domain/errors";

export async function assertDemoConsole(context: AppContext, requestId: string, request?: Request): Promise<void> {
  void context;
  const session = await getConsoleSession();
  if (!session || !canViewConsole(session.role)) {
    throw new InvalidRequestError(requestId, "Sign in is required.");
  }
  if (request) assertSameOrigin(request, requestId);
}

export function assertSameOrigin(request: Request, requestId: string): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host");
  if (!host) return;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new InvalidRequestError(requestId, "The request origin is not allowed.");
  }
  if (parsed.host !== host) {
    throw new InvalidRequestError(requestId, "The request origin is not allowed.");
  }
}
