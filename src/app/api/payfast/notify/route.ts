/**
 * PayFast ITN (Instant Transaction Notification) handler — receives PayFast's
 * server-to-server notification of payment outcome and finalises the order.
 *
 * Why it exists:
 * PayFast's `return_url` brings the customer back to the success page, but
 * that's a browser redirect under the customer's control. The ITN is the
 * only authoritative confirmation that money actually moved. Anything
 * customer-visible (email, Klaviyo, courier dispatch) must wait for this
 * handler, not the redirect.
 *
 * Architecture:
 * - verifyItnSignature() — MD5 of the ordered form fields + passphrase,
 *   constant-time compared against the `signature` value in the body.
 * - validateItnWithPayFast() — server-to-server POST to
 *   `/eng/query/validate` with the raw body. PayFast responds `VALID` if
 *   the ITN it sent matches what we received.
 * - Amount check — defensive: `amount_gross` must equal the order total.
 * - Race-safe transition — `UPDATE orders SET status='paid' WHERE
 *   id=... AND status='pending'` with `.select("id")`. Losers of the
 *   pending→paid race return early before side effects so concurrent
 *   ITN redeliveries don't fire emails or courier shipments twice.
 *
 * Response codes:
 * - 4xx on signature mismatch / failed PayFast validation — PayFast will
 *   retry; if these keep failing investigate the merchant key.
 * - 200 on duplicate or unknown event — stops retries; safe because the
 *   status guard makes processing idempotent.
 * - 500 on transient DB error — PayFast will retry.
 */

import { Resend } from "resend";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  parseItnBody,
  verifyItnSignature,
  validateItnWithPayFast,
} from "@/lib/payfast";
import {
  createCourierGuyShipment,
  isCourierGuyConfigured,
} from "@/lib/courier-guy";
import { trackKlaviyoEvent, isKlaviyoConfigured } from "@/lib/klaviyo";
import {
  merchantOrderNotificationHtml,
  orderConfirmationHtml,
} from "@/lib/email-templates";
import type { Order, OrderItem } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const { fields, signature } = parseItnBody(rawBody);

  if (!signature || !verifyItnSignature(fields, signature)) {
    console.warn("PayFast ITN: invalid signature");
    return new Response("Invalid signature", { status: 400 });
  }

  // Server-to-server: ask PayFast to confirm they sent this ITN. Defends
  // against a forged signature from anyone who guessed the merchant key.
  const valid = await validateItnWithPayFast(rawBody).catch((err) => {
    console.warn("PayFast ITN: validate call threw", err);
    return false;
  });
  if (!valid) {
    console.warn("PayFast ITN: validation with PayFast failed");
    return new Response("PayFast validation failed", { status: 400 });
  }

  const orderId = fields.m_payment_id;
  const pfPaymentId = fields.pf_payment_id ?? null;
  const paymentStatus = fields.payment_status;
  const amountGross = Number(fields.amount_gross);

  if (!orderId) {
    console.warn("PayFast ITN: missing m_payment_id");
    return new Response("Missing m_payment_id", { status: 400 });
  }

  if (paymentStatus !== "COMPLETE") {
    // CANCELLED / FAILED — mark the order accordingly so the merchant
    // can see what happened without us digging into the PayFast dashboard.
    const supabase = createServerSupabase();
    const nextStatus = paymentStatus === "CANCELLED" ? "cancelled" : "failed";
    await supabase
      .from("orders")
      .update({ status: nextStatus, payfast_pf_payment_id: pfPaymentId })
      .eq("id", orderId)
      .eq("status", "pending");
    return new Response(`Status ${paymentStatus}`, { status: 200 });
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

  const expectedTotal = Number(order.total);
  if (!Number.isFinite(amountGross) || Math.abs(amountGross - expectedTotal) > 0.01) {
    console.error("PayFast ITN: amount mismatch", {
      orderId,
      expected: expectedTotal,
      received: amountGross,
    });
    await supabase
      .from("orders")
      .update({ status: "failed", payfast_pf_payment_id: pfPaymentId })
      .eq("id", orderId)
      .eq("status", "pending");
    return new Response("Amount mismatch", { status: 200 });
  }

  if (order.status === "paid") {
    return new Response("Already processed", { status: 200 });
  }

  if (order.status !== "pending") {
    console.warn("PayFast ITN: unexpected order state", {
      orderId,
      status: order.status,
    });
    return new Response("Order not pending", { status: 200 });
  }

  // Race-safe transition: only one concurrent ITN can flip pending → paid.
  // .select("id") makes the row count visible so losers bail out before
  // running the side effects — otherwise concurrent retries would double
  // the customer's emails and create two Courier Guy shipments.
  const { data: updatedRows, error: updateError } = await supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payfast_pf_payment_id: pfPaymentId,
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("id");

  if (updateError) {
    console.error("PayFast ITN: order update failed", updateError);
    return new Response("DB error", { status: 500 });
  }

  if (!updatedRows || updatedRows.length === 0) {
    return new Response("Already processed (race)", { status: 200 });
  }

  const [{ data: latestOrder }, { data: items }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).single<Order>(),
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .returns<OrderItem[]>(),
  ]);

  if (!latestOrder || !items) {
    console.warn("PayFast ITN: unable to fetch order or items after payment", {
      orderId,
    });
  } else {
    const trackingPromises = [sendConfirmationEmail(orderId)];

    if (isKlaviyoConfigured()) {
      trackingPromises.push(
        trackKlaviyoEvent(
          "Placed Order",
          {
            email: latestOrder.email,
            first_name: latestOrder.first_name,
            last_name: latestOrder.last_name,
          },
          {
            order_id: latestOrder.id,
            total: latestOrder.total,
            currency: latestOrder.currency,
            shipping_cost: latestOrder.shipping_cost,
            discount_amount: latestOrder.discount_amount,
            payment_reference: pfPaymentId,
          },
        ),
      );
    }

    await Promise.allSettled(trackingPromises);

    if (isCourierGuyConfigured()) {
      try {
        const shipment = await createCourierGuyShipment(latestOrder, items);
        await supabase
          .from("orders")
          .update({
            shipping_status: shipment.status,
            courier: shipment.courier,
            tracking_number: shipment.trackingNumber,
            tracking_url: shipment.trackingUrl,
            waybill_number: shipment.waybillNumber,
            shipped_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        if (isKlaviyoConfigured()) {
          await trackKlaviyoEvent(
            "Shipped Order",
            {
              email: latestOrder.email,
              first_name: latestOrder.first_name,
              last_name: latestOrder.last_name,
            },
            {
              order_id: latestOrder.id,
              tracking_number: shipment.trackingNumber,
              tracking_url: shipment.trackingUrl,
              waybill_number: shipment.waybillNumber,
              courier: shipment.courier,
              total: latestOrder.total,
              currency: latestOrder.currency,
            },
          );
        }
      } catch (err) {
        console.error("PayFast ITN: courier shipment failed", err);
        await supabase
          .from("orders")
          .update({ shipping_status: "failed" })
          .eq("id", orderId);
      }
    }
  }

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
  const merchantEmail = process.env.MERCHANT_NOTIFICATION_EMAIL;

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

  // Merchant notification only fires when MERCHANT_NOTIFICATION_EMAIL is set —
  // we don't silently fall back to a personal address.
  const sendMerchant = merchantEmail
    ? resend.emails
        .send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: merchantEmail,
          replyTo: order.email,
          subject: `New order #${shortId} — ${order.first_name} ${order.last_name} — R${Number(order.total).toFixed(2)}`,
          html: merchantOrderNotificationHtml(order, items),
        })
        .catch((err) => {
          console.error("PayFast ITN: merchant email failed", err);
        })
    : Promise.resolve(
        console.warn(
          "PayFast ITN: MERCHANT_NOTIFICATION_EMAIL not set — skipping merchant notification",
        ),
      );

  await Promise.all([sendCustomer, sendMerchant]);
}
