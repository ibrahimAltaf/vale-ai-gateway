import { NextResponse } from "next/server";

import { errorResponse, requestIdFrom } from "@/server/api/http";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const accept = request.headers.get("accept") ?? "";
    const response = accept.includes("text/html")
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.json({ ok: true });
    response.cookies.set("vale_session", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
