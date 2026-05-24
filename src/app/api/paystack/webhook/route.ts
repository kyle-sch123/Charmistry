import { Resend } from "resend";
import { createServerSupabase } from "@/lib/supabase-server";
import { verifyWebhookSignature } from "@/lib/paystack";
import {
  merchantOrderNotificationHtml,
  orderConfirmationHtml,
} from "@/lib/email-templates";
import type { Order, OrderItem } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("Paystack webhook: invalid signature");
    return new Response("Invalid signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.warn("Paystack webhook: invalid JSON", err);
    return new Response("Invalid payload", { status: 400 });
  }

  if (event.event !== "charge.success") {
    return new Response("Ignored", { status: 200 });
  }

  const { data } = event;
  if (!data || data.status !== "success") {
    return new Response("Ignored", { status: 200 });
  }

  const orderId = data.metadata?.orderId;
  const reference = data.reference ?? null;
  const transactionId = data.id ?? null;
  const amountPaid = Number(data.amount) / 100;

  if (!orderId) {
    console.warn("Paystack webhook: missing orderId metadata");
    return new Response("Missing orderId", { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single<Order>();

  if (fetchError || !order) {
    console.warn("Paystack webhook: order not found", { orderId, fetchError });
    return new Response("Order not found", { status: 200 });
  }

  const expectedTotal = Number(order.total);
  if (
    !Number.isFinite(amountPaid) ||
    Math.abs(amountPaid - expectedTotal) > 0.01
  ) {
    console.error("Paystack webhook: amount mismatch", {
      orderId,
      expected: expectedTotal,
      received: amountPaid,
    });
    await supabase
      .from("orders")
      .update({ status: "failed", payfast_pf_payment_id: transactionId })
      .eq("id", orderId)
      .eq("status", "pending");
    return new Response("Amount mismatch", { status: 200 });
  }

  if (order.status === "paid") {
    return new Response("Already processed", { status: 200 });
  }

  if (order.status !== "pending") {
    console.warn("Paystack webhook: unexpected order state", {
      orderId,
      status: order.status,
    });
    return new Response("Order not pending", { status: 200 });
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payfast_payment_id: reference,
      payfast_pf_payment_id: transactionId,
    })
    .eq("id", orderId)
    .eq("status", "pending");

  if (updateError) {
    console.error("Paystack webhook: order update failed", updateError);
    return new Response("DB error", { status: 500 });
  }

  await sendConfirmationEmail(orderId).catch((err) => {
    console.error("Paystack webhook: confirmation email failed", err);
  });

  return new Response("OK", { status: 200 });
}

async function sendConfirmationEmail(orderId: string): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;

  const supabase = createServerSupabase();
  const [{ data: order }, { data: items }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).single<Order>(),
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .returns<OrderItem[]>(),
  ]);

  if (!order || !items) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const shortId = order.id.slice(0, 8).toUpperCase();
  const merchantEmail =
    process.env.MERCHANT_NOTIFICATION_EMAIL ?? "kyleschaffner39@gmail.com";

  const sendCustomer = resend.emails
    .send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: order.email,
      subject: `Order confirmed — Charmistry #${shortId}`,
      html: orderConfirmationHtml(order, items),
    })
    .catch((err) => {
      console.error("Paystack webhook: customer email failed", err);
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
      console.error("Paystack webhook: merchant email failed", err);
    });

  await Promise.all([sendCustomer, sendMerchant]);
}
