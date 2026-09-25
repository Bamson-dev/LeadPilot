import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const VISITOR_IP_HEADER = "x-leadthur-client-ip";

function incomingClientIp(request: NextRequest): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "";
}

/**
 * Same-origin `/backend` rewrites go VPS → Cloudflare → backend, which
 * overwrites cf-connecting-ip with the origin IP. Copy the real visitor IP
 * onto a hop header the API can trust from infrastructure.
 */
export function middleware(request: NextRequest) {
  const ip = incomingClientIp(request);
  if (!ip) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set(VISITOR_IP_HEADER, ip);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/backend/:path*"],
};
