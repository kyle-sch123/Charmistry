/**
 * Auth middleware — deliberately an INCLUDE-list.
 *
 * Only the account area and the login page need per-request session refresh
 * and guarding. Everything else — the storefront, /api/checkout, and above
 * all the PayFast ITN webhook (/api/payfast/notify) — must never gain a new
 * failure mode from auth, so it is simply not matched.
 *
 * /auth/callback and /auth/confirm manage their own cookies as Route
 * Handlers and don't need (or want) middleware in front of them.
 */

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/account/:path*", "/login"],
};
