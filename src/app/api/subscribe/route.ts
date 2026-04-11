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

  // Add contact to Resend Audiences
  const { error: contactError } = await resend.contacts.create({
    email,
    audienceId: process.env.RESEND_AUDIENCE_ID,
    unsubscribed: false,
  });

  if (contactError) {
    // Resend returns 422 for existing contacts (not 409 — varies by SDK version)
    const statusCode = (contactError as { statusCode?: number }).statusCode ?? 0;
    if (statusCode === 409 || statusCode === 422) {
      return Response.json({ error: "already_subscribed" }, { status: 409 });
    }
    console.error("Resend contacts error:", contactError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  const discountCode = generateDiscountCode();

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
