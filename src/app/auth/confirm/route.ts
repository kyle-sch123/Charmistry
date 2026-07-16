/**
 * Email link verification via token_hash — the landing for the customised
 * Magic Link template ({{ .SiteURL }}/auth/confirm?token_hash=...&type=email).
 *
 * Unlike the PKCE ?code path in /auth/callback, a token_hash verifies in any
 * browser, so this works when the email is opened on a different device from
 * the one that requested it.
 */

import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createAuthServerClient } from "@/lib/auth/server";
import { ensureProfileAndClaimOrders } from "@/lib/account";
import { sanitizeNextPath } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNextPath(url.searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createAuthServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error && data.user) {
      await ensureProfileAndClaimOrders(data.user);
      return NextResponse.redirect(new URL(next, url.origin));
    }
    console.error("[auth/confirm] verifyOtp failed:", error?.message);
  }

  return NextResponse.redirect(new URL("/login?error=auth", url.origin));
}
