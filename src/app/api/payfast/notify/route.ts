import { Resend } from "resend";
import { createServerSupabase } from "@/lib/supabase-server";
import { verifyItnSignature, validateItnWithPayFast } from "@/lib/payfast";
import { orderConfirmationHtml, merchantOrderNotificationHtml } from "@/lib/email-templates";
import type { Order, OrderItem } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PayFast ITN handler — must always return 200 so PayFast doesn't retry
// forever once we've definitively decided the outcome. For transient errors
// (e.g. DB failure) we intentionally return 500 so PayFast retries.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = parseFormBody(rawBody);

  // Step 1: signature check
  if (!verifyItnSignature(params)) {
    console.warn("PayFast ITN: signature mismatch", { paymentId: params.m_payment_id });
    return new Response("Invalid signature", { status: 200 });
  }

  // Step 2: server-to-server validation with PayFast
  try {
    const valid = await validateItnWithPayFast(rawBody);
    if (!valid) {
      console.warn("PayFast ITN: server validate failed", { paymentId: params.m_payment_id });
      return new Response("Not valid", { status: 200 });
    }
  } catch (err) {
    console.error("PayFast ITN: validate call errored", err);
    return new Response("Validation error", { status: 500 });
  }

  const orderId = params.m_payment_id;
  const paymentStatus = params.payment_status;
  const receivedAmount = Number(params.amount_gross);
  const pfPaymentId = params.pf_payment_id ?? null;

  if (!orderId) {
    return new Response("Missing order id", { status: 200 });
  }

  const supabase = createServerSupabase();

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single<Order>();

  if (fetchError || !order) {
    console.warn("PayFast ITN: order not found", { orderId, fetchError });
    return new Response("Order not found", { status: 200 });
  }

  // Step 3: amount check — prevent a tampered form from under-paying
  if (!Number.isFinite(receivedAmount) || Math.abs(receivedAmount - Number(order.total)) > 0.01) {
    console.error("PayFast ITN: amount mismatch", {
      orderId,
      expected: order.total,
      received: receivedAmount,
    });
    await supabase
      .from("orders")
      .update({ status: "failed", payfast_pf_payment_id: pfPaymentId })
      .eq("id", orderId)
      .eq("status", "pending");
    return new Response("Amount mismatch", { status: 200 });
  }

  // Idempotency: if the order is already paid, do nothing.
  if (order.status === "paid") {
    return new Response("Already processed", { status: 200 });
  }

  // Only allow transitions from pending
  if (order.status !== "pending") {
    console.warn("PayFast ITN: unexpected order state", { orderId, status: order.status });
    return new Response("Order not pending", { status: 200 });
  }

  if (paymentStatus === "COMPLETE") {
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        payfast_payment_id: params.m_payment_id ?? null,
        payfast_pf_payment_id: pfPaymentId,
      })
      .eq("id", orderId)
      .eq("status", "pending");

    if (updateError) {
      console.error("PayFast ITN: order update failed", updateError);
      return new Response("DB error", { status: 500 });
    }

    // Fire-and-forget confirmation email
    await sendConfirmationEmail(orderId).catch((err) => {
      console.error("PayFast ITN: confirmation email failed", err);
    });

    return new Response("OK", { status: 200 });
  }

  if (paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
    await supabase
      .from("orders")
      .update({
        status: paymentStatus === "CANCELLED" ? "cancelled" : "failed",
        payfast_pf_payment_id: pfPaymentId,
      })
      .eq("id", orderId)
      .eq("status", "pending");
    return new Response("OK", { status: 200 });
  }

  // Pending / unknown states — leave the order alone, PayFast may re-notify.
  return new Response("OK", { status: 200 });
}

function parseFormBody(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const pairs = raw.split("&");
  for (const pair of pairs) {
    if (!pair) continue;
    const eqIdx = pair.indexOf("=");
    const key = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
    const value = eqIdx === -1 ? "" : pair.slice(eqIdx + 1);
    try {
      // PayFast sends form-urlencoded, so spaces come through as '+'
      out[decodeURIComponent(key.replace(/\+/g, " "))] = decodeURIComponent(
        value.replace(/\+/g, " "),
      );
    } catch {
      // Ignore malformed pairs
    }
  }
  return out;
}

async function sendConfirmationEmail(orderId: string): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;

  const supabase = createServerSupabase();
  const [{ data: order }, { data: items }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).single<Order>(),
    supabase.from("order_items").select("*").eq("order_id", orderId).returns<OrderItem[]>(),
  ]);

  if (!order || !items) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const shortId = order.id.slice(0, 8).toUpperCase();
  const merchantEmail = process.env.MERCHANT_NOTIFICATION_EMAIL ?? "kyleschaffner39@gmail.com";

  // Customer confirmation + merchant notification fire in parallel. Each is
  // wrapped so one failure doesn't block the other.
  const sendCustomer = resend.emails
    .send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: order.email,
      subject: `Order confirmed — Charmistry #${shortId}`,
      html: orderConfirmationHtml(order, items),
    })
    .catch((err) => {
      console.error("PayFast ITN: customer email failed", err);
    });

  const sendMerchant = resend.emails
    .send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: merchantEmail,
      replyTo: order.email,
      subject: `New order #${shortId} — ${order.first_name} ${order.last_name} — R${Number(order.total).toFixed(2)}`,
      html: merchantOrderNotificationHtml(order, items),
    })
    .catch((err) => {
      console.error("PayFast ITN: merchant email failed", err);
    });

  await Promise.all([sendCustomer, sendMerchant]);
}
