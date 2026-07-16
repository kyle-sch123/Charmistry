/**
 * Account bootstrap: make sure a profile row exists and attach any past
 * guest orders to the user.
 *
 * Claiming is an exact match on the order email (lowercased at insert by
 * /api/checkout) against the user's VERIFIED auth email — deliberately not
 * canonicaliseEmail(): collapsing dots/plus-aliases would hand over orders
 * the user never proved ownership of on non-Gmail domains.
 *
 * Runs with the service role (guest orders are invisible to client roles by
 * design), is idempotent, and is called from /auth/callback, /auth/confirm,
 * and the /account layout — the layout call covers the client-side OTP path,
 * which never passes through a server auth route.
 *
 * Never throws: a failure here must not take down sign-in or the account
 * pages; the next call retries the same idempotent work.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import type { User } from "@supabase/supabase-js";

export async function ensureProfileAndClaimOrders(user: User): Promise<void> {
  try {
    const supabase = createServerSupabase();

    // The on_auth_user_created trigger normally creates this row; upsert is
    // the belt-and-braces fallback (and heals users created before 008).
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
    if (profileError) {
      console.error("[account] profile upsert failed:", profileError.message);
    }

    const email = user.email?.toLowerCase();
    if (!email || !user.email_confirmed_at) return;

    const { error: claimError } = await supabase
      .from("orders")
      .update({ user_id: user.id })
      .is("user_id", null)
      .eq("email", email);
    if (claimError) {
      console.error("[account] guest-order claim failed:", claimError.message);
    }
  } catch (err) {
    console.error("[account] ensureProfileAndClaimOrders failed:", err);
  }
}
