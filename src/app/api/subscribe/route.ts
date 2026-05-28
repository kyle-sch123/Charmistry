/**
 * POST /api/subscribe — newsletter signup with a single-use welcome code.
 *
 * Order of operations (ORDER MATTERS):
 *   1. Lookup existing active code for this canonical email → 409 if present.
 *   2. resend.contacts.create() — adds the email to the audience. If Resend
 *      reports the contact already exists, return 409 without persisting
 *      a code, so a duplicate signup doesn't accumulate orphan codes.
 *   3. Insert the discount_codes row. Retries up to 5 times on a Postgres
 *      unique-violation (23505) of the `code` constraint since the random
 *      suffix can collide, vanishingly rarely. A 23505 on the
 *      `email_canonical` constraint instead means a concurrent /api/subscribe
 *      won the race for the same inbox — short-circuit to 409.
 *   4. resend.emails.send() — best-effort welcome email; failure is logged
 *      but does not roll back the signup.
 *
 * Code shape: CHARM-XXXXXX, six chars from a confusion-free alphabet,
 * sourced from crypto.randomBytes (not Math.random) so codes aren't guessable.
 *
 * Each welcome code is 10% off, single-use, tied to the email, 90-day expiry.
 *
 * Duplicate-signup prevention: the lookup and the insert both key on
 * `email_canonical` (see lib/email.ts:canonicaliseEmail) — same address with
 * plus-addressing stripped and Gmail-dot variants collapsed — so
 * `bob+1@gmail.com` and `b.o.b@gmail.com` resolve to the same row. A partial
 * unique index on (email_canonical) where active=true enforces one welcome
 * code per real inbox at the DB level, making concurrent subscribes
 * race-safe and making alias-based abuse impossible.
 */

export const runtime = "nodejs";

import crypto from "node:crypto";
import { Resend } from "resend";
import { welcomeEmailHtml } from "@/lib/email-templates";
import { createServerSupabase } from "@/lib/supabase-server";
import { canonicaliseEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Crockford-style alphabet — no 0/O or 1/I confusion, no lowercase.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

function generateDiscountCode(): string {
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return `CHARM-${suffix}`;
}

export async function POST(request: Request) {
  // Guard: env vars must be present
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_AUDIENCE_ID || !process.env.RESEND_FROM_EMAIL) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let email: string;
  try {
    const body = await request.json();
    email = (body?.email ?? "").trim().toLowerCase();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  const emailCanonical = canonicaliseEmail(email);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = createServerSupabase();

  // Check whether this inbox already has an active welcome code before
  // calling Resend — avoids creating orphan discount rows for repeats. The
  // lookup keys on the canonical form so `bob+1@gmail.com`, `bob+2@gmail.com`
  // and `b.o.b@gmail.com` all collapse to the same hit.
  const { data: existing, error: existingError } = await supabase
    .from("discount_codes")
    .select("code")
    .eq("email_canonical", emailCanonical)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("subscribe: lookup existing code failed", existingError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  if (existing?.code) {
    return Response.json({ error: "already_subscribed" }, { status: 409 });
  }

  // Add contact to Resend Audiences first. If they're already in the audience
  // we want to treat that as already_subscribed without persisting a new code.
  const { data: contactData, error: contactError } = await resend.contacts.create({
    email,
    audienceId: process.env.RESEND_AUDIENCE_ID,
    unsubscribed: false,
  });

  if (contactError) {
    const err = contactError as { message?: string; name?: string; statusCode?: number };
    console.error("Resend contacts error:", {
      name: err.name,
      message: err.message,
      statusCode: err.statusCode,
      audienceId: process.env.RESEND_AUDIENCE_ID,
    });
    const msg = (err.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("exist")) {
      return Response.json({ error: "already_subscribed" }, { status: 409 });
    }
    return Response.json({ error: "service_error", detail: err.message }, { status: 500 });
  }

  if (!contactData?.id) {
    console.error("Resend contacts: no id returned", contactData);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  // Now persist the welcome code. Retry on unique-constraint collision since
  // generateDiscountCode can theoretically (very rarely) repeat.
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  let discountCode = "";
  let codeInserted = false;
  for (let attempt = 0; attempt < 5 && !codeInserted; attempt++) {
    discountCode = generateDiscountCode();
    const { error: codeError } = await supabase.from("discount_codes").insert({
      code: discountCode,
      discount_type: "percentage",
      discount_value: 10,
      min_order_amount: 0,
      max_uses: 1,
      email,
      email_canonical: emailCanonical,
      expires_at: expiresAt,
      active: true,
    });
    if (!codeError) {
      codeInserted = true;
      break;
    }
    // 23505 = unique-constraint violation. Two constraints can fire it here:
    //   - `code` collision: extremely rare. Retry with a new random suffix.
    //   - `email_canonical` collision: a concurrent /api/subscribe just
    //     persisted a code for this inbox between our lookup and our insert.
    //     Treat the same as the lookup having found a row — return 409.
    const pgCode = (codeError as { code?: string }).code;
    const codeErrMsg = (codeError as { message?: string }).message ?? "";
    if (pgCode === "23505" && codeErrMsg.includes("email_canonical")) {
      return Response.json({ error: "already_subscribed" }, { status: 409 });
    }
    if (pgCode !== "23505") {
      console.error("subscribe: discount_codes insert failed", codeError);
      return Response.json({ error: "service_error" }, { status: 500 });
    }
  }
  if (!codeInserted) {
    console.error("subscribe: could not generate unique discount code");
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  // Send welcome email — non-fatal if this fails
  const { error: emailError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: email,
    subject: "Welcome to the Charmistry Club — here's your discount",
    html: welcomeEmailHtml(discountCode),
  });

  if (emailError) {
    console.error("Resend email send error:", emailError);
    // Still return success — the contact was saved, email delivery is best-effort
  }

  return Response.json({ success: true, discountCode }, { status: 200 });
}
