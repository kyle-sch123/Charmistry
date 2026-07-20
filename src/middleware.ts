/**
 * Auth middleware — deliberately an INCLUDE-list.
 *
 * Two independent guards, split by path:
 *   /admin/**            -> Basic-Auth password gate (guardAdmin)
 *   /account/**, /login  -> Supabase session refresh + guard (updateSession)
 *
 * Only these paths need per-request work. Everything else — the storefront,
 * /api/checkout, and above all the PayFast ITN webhook (/api/payfast/notify) —
 * must never gain a new failure mode from auth, so it is simply not matched.
 *
 * The admin *APIs* (/api/admin/**) are intentionally NOT gated here: they keep
 * their own x-admin-key check, and a Basic-Auth challenge in front would break
 * the fulfil client's fetch calls.
 *
 * /auth/callback and /auth/confirm manage their own cookies as Route Handlers
 * and don't need (or want) middleware in front of them.
 */

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/middleware";
import { guardAdmin } from "@/lib/auth/admin-gate";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return guardAdmin(request);
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/account/:path*", "/login", "/admin/:path*"],
};
