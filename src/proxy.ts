import { NextResponse, type NextRequest } from "next/server";

import { readSessionToken } from "@/server/auth/tokens";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/v1/", "/icon.svg"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/auth/logout" || pathname === "/api/auth/session") return NextResponse.next();
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path))) {
    return NextResponse.next();
  }
  const session = readSessionToken(request.cookies.get("vale_session")?.value);
  if (session) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", message: "Sign in is required.", requestId: "req_unauthenticated", providerContacted: false, sensitiveDataTransmitted: false },
      { status: 401 },
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
