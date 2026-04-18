export const runtime = "edge";

import { Resend } from "resend";
import { welcomeEmailHtml } from "@/lib/email-templates";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateDiscountCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
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

  const resend = new Resend(process.env.RESEND_API_KEY);

  const discountCode = generateDiscountCode();

  // Add contact to Resend Audiences. Resend's contacts.create is effectively
  // an upsert — it won't error on duplicates, it just returns the existing one.
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
    // Only treat as duplicate if the message actually says so
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
