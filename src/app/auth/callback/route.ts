/**
 * PKCE auth landing — both OAuth (Google) redirects and clicked magic-link
 * emails using the default template arrive here with a ?code to exchange.
 *
 * The code exchange needs the PKCE verifier cookie set when the flow started,
 * so links only work in the browser that requested them — the emailed OTP
 * path on /login is the cross-device fallback. On success we bootstrap the
 * profile and claim past guest orders before redirecting to a sanitised
 * ?next target.
 */

import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/auth/server";
import { ensureProfileAndClaimOrders } from "@/lib/account";
import { sanitizeNextPath } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createAuthServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await ensureProfileAndClaimOrders(data.user);
      return NextResponse.redirect(new URL(next, url.origin));
    }
    console.error("[auth/callback] code exchange failed:", error?.message);
  }

  return NextResponse.redirect(new URL("/login?error=auth", url.origin));
}
