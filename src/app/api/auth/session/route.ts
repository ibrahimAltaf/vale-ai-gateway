import { errorResponse, requestIdFrom } from "@/server/api/http";
import { cookies } from "next/headers";

import { readSessionToken } from "@/server/auth/tokens";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const session = readSessionToken((await cookies()).get("vale_session")?.value);
    if (!session) return Response.json({ ok: false, authenticated: false }, { status: 401 });
    return Response.json({ ok: true, authenticated: true, email: session.email, role: session.role });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
