/**
 * POST /api/discount/validate — checks a discount code without consuming it.
 *
 * Email is REQUIRED in the request body. Email-bound codes (e.g. welcome
 * codes from /api/subscribe) would otherwise be probable: any client could
 * test codes without revealing which email they belong to. Requiring email
 * here forces the caller to commit to one before the resolve runs.
 *
 * Returns 400 with reason: not_found | inactive | expired | max_uses_reached
 * | min_order_not_met | email_mismatch | email_required.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import { resolveDiscount } from "@/lib/discounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Body {
  code?: string;
  subtotal?: number;
  email?: string;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const subtotal = Number(body.subtotal ?? 0);
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!code) return Response.json({ error: "code_required" }, { status: 400 });
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return Response.json({ error: "invalid_subtotal" }, { status: 400 });
  }
  // Email is required so we can enforce email-bound codes here, rather than
  // letting clients probe codes anonymously.
  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: "email_required" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const result = await resolveDiscount(supabase, code, subtotal, email);

  if (typeof result === "string") {
    return Response.json({ error: result }, { status: 400 });
  }

  return Response.json({
    success: true,
    code: result.code.code,
    discount_type: result.code.discount_type,
    discount_value: Number(result.code.discount_value),
    amount: result.amount,
  });
}
