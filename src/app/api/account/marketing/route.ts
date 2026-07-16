/**
 * POST /api/account/marketing — { optIn: boolean }
 *
 * Flips the signed-in user's marketing preference. The profiles row is the
 * source of truth; the Resend audience sync (same audience /api/subscribe
 * feeds) is best-effort — a Resend outage must not lose the preference, and
 * the flag can be reconciled later. Unlike /api/subscribe, opting in here
 * mints NO welcome discount code and sends no email: this is an existing
 * customer managing their preference, not a new signup.
 *
 * Auth: the session cookie is the credential. The user id/email come from
 * the verified session — nothing identity-shaped is read from the body.
 */

export const runtime = "nodejs";

import { Resend } from "resend";
import { getVerifiedUser } from "@/lib/auth/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const user = await getVerifiedUser();
  if (!user) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }

  let optIn: boolean;
  try {
    const body = await request.json();
    if (typeof body?.optIn !== "boolean") throw new Error("bad optIn");
    optIn = body.optIn;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ marketing_opt_in: optIn })
    .eq("id", user.id);

  if (updateError) {
    console.error("account/marketing: profile update failed", updateError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  // Best-effort Resend audience sync. Contact may or may not exist yet:
  // create first, fall back to update when it already does.
  const email = user.email?.toLowerCase();
  if (email && process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const audienceId = process.env.RESEND_AUDIENCE_ID;
      const { error: createError } = await resend.contacts.create({
        email,
        audienceId,
        unsubscribed: !optIn,
      });
      if (createError) {
        const msg = (createError.message ?? "").toLowerCase();
        if (msg.includes("already") || msg.includes("exist")) {
          const { error: updateContactError } = await resend.contacts.update({
            email,
            audienceId,
            unsubscribed: !optIn,
          });
          if (updateContactError) throw updateContactError;
        } else {
          throw createError;
        }
      }
    } catch (err) {
      console.error("account/marketing: Resend sync failed (non-fatal)", err);
    }
  }

  return Response.json({ success: true, optIn }, { status: 200 });
}
