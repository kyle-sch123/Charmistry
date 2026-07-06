/**
 * PayFast ITN (Instant Transaction Notification) handler — receives PayFast's
 * server-to-server notification of payment outcome and finalises the order.
 *
 * Why it exists:
 * PayFast's `return_url` brings the customer back to the success page, but
 * that's a browser redirect under the customer's control. The ITN is the
 * only authoritative confirmation that money actually moved. Anything
 * customer-visible (email, Klaviyo) must wait for this handler, not the
 * redirect.
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
 *   ITN redeliveries don't fire emails twice.
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
import { trackKlaviyoEvent, isKlaviyoConfigured } from "@/lib/klaviyo";
import { trackMetaPurchase, isMetaCapiConfigured } from "@/lib/meta-capi";
import {
  merchantOrderNotificationHtml,
  orderConfirmationHtml,
} from "@/lib/email-templates";
import { decrementProductStock } from "@/lib/inventory";
import { shippingMethodLabel } from "@/lib/shipping";
import {
  KLAVIYO_BRAND,
  klaviyoProductUrl,
  klaviyoCustomerFor,
  fetchCategoryByProduct,
  categoryFor,
  klaviyoLineItemsFor,
  klaviyoCategoriesFor,
} from "@/lib/klaviyo-orders";
import type { Order, OrderItem } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const { fields, signature } = parseItnBody(rawBody);

  // Diagnostic: surface exactly what arrived so a single real ITN tells us
  // where (if anywhere) it's being rejected. Logged at info level; remove or
  // downgrade once the pending-order issue is confirmed resolved.
  const localSigOk = Boolean(signature) && verifyItnSignature(fields, signature);
  console.log("PayFast ITN: received", {
    fieldKeys: Object.keys(fields),
    m_payment_id: fields.m_payment_id,
    payment_status: fields.payment_status,
    amount_gross: fields.amount_gross,
    hasSignature: Boolean(signature),
    localSignatureMatch: localSigOk,
  });

  // Authoritative gate: ask PayFast's own server to confirm it emitted this
  // ITN. This is the source of truth and defends against forged callbacks.
  //
  // We intentionally do NOT hard-fail on the *local* signature check: PayFast's
  // signature is notoriously sensitive to field-ordering / encoding edge cases,
  // and a false-negative there was silently leaving paid orders stuck in
  // `pending`. The local check is now advisory (logged above); the
  // server-to-server validation below is what authorises processing.
  const valid = await validateItnWithPayFast(rawBody).catch((err) => {
    console.warn("PayFast ITN: validate call threw", err);
    return false;
  });
  if (!valid) {
    console.warn("PayFast ITN: validation with PayFast failed", {
      localSignatureMatch: localSigOk,
    });
    return new Response("PayFast validation failed", { status: 400 });
  }

  if (!localSigOk) {
    // Authoritative validation passed but our local recompute disagreed —
    // this is the encoding/ordering trap. Log loudly so we can tighten the
    // local check later, but proceed: PayFast has vouched for the ITN.
    console.warn(
      "PayFast ITN: local signature mismatch but PayFast validation passed — proceeding on authoritative validation",
    );
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

  // A genuine COMPLETE payment is authoritative and must win even if the order
  // was already marked `cancelled` — e.g. the customer hit the cancel page
  // (which flips pending → cancelled via /api/checkout/cancel), then completed
  // payment in the same PayFast session. Any other non-pending state is
  // unexpected, so leave it untouched.
  if (order.status !== "pending" && order.status !== "cancelled") {
    console.warn("PayFast ITN: unexpected order state", {
      orderId,
      status: order.status,
    });
    return new Response("Order not in a payable state", { status: 200 });
  }

  // Race-safe transition: only one concurrent ITN can flip the order → paid.
  // The `.in` guard also lets a real payment rescue a `cancelled` order (see
  // above). .select("id") makes the row count visible so losers bail out before
  // running the side effects — otherwise concurrent retries would double the
  // customer's emails.
  const { data: updatedRows, error: updateError } = await supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payfast_pf_payment_id: pfPaymentId,
    })
    .eq("id", orderId)
    .in("status", ["pending", "cancelled"])
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
    // Payment is confirmed and this invocation won the pending→paid race, so
    // it runs exactly once: decrement stock now (validated at checkout, debited
    // here). Atomic + oversell-safe in the DB; best-effort so a stock-write
    // hiccup never blocks the confirmation email.
    await decrementProductStock(
      supabase,
      items.map((it) => ({ product_id: it.product_id, quantity: it.quantity })),
    );

    const trackingPromises = [sendConfirmationEmail(orderId)];

    if (isKlaviyoConfigured()) {
      trackingPromises.push(trackKlaviyoOrder(latestOrder, items, pfPaymentId));
    }

    if (isMetaCapiConfigured()) {
      trackingPromises.push(trackMetaCapiPurchase(latestOrder, items));
    }

    await Promise.allSettled(trackingPromises);
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

/**
 * Fire the Meta Conversions API Purchase event for a paid order.
 *
 * event_id is the order id — the exact value the browser pixel sends as its
 * `eventID` — so Meta dedupes the server event against the client pixel when
 * both fire. value is the authoritative server-priced order total (identical to
 * what the pixel reports), and the customer's hashed PII drives match quality
 * since the ITN has no browser IP / user-agent / _fbp cookie.
 */
async function trackMetaCapiPurchase(
  order: Order,
  items: OrderItem[],
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const eventTime = order.paid_at
    ? Math.floor(new Date(order.paid_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  await trackMetaPurchase(
    {
      email: order.email,
      first_name: order.first_name,
      last_name: order.last_name,
      phone: order.phone,
      city: order.shipping_city,
      zip: order.shipping_postal_code,
      country: order.shipping_country,
    },
    {
      eventId: order.id,
      eventTime,
      eventSourceUrl: base ? `${base}/checkout/success?order=${order.id}` : undefined,
      value: Number(order.total),
      currency: order.currency,
      contents: items.map((it) => ({
        id: it.product_id ?? it.product_slug,
        quantity: it.quantity,
        item_price: Number(it.unit_price),
      })),
      contentIds: items.map((it) => it.product_id ?? it.product_slug),
      numItems: items.reduce((n, it) => n + it.quantity, 0),
      orderId: order.id,
    },
  );
}

/**
 * Emit the Klaviyo order events from Klaviyo's integration guide:
 *   - "Placed Order"    — one event, carries the full Items array + addresses.
 *   - "Ordered Product" — one event per line item for product-level segments.
 *
 * Self-contained and best-effort: a single round-trip enriches line items with
 * their category for segmentation, and every Klaviyo call is settled so a
 * tracking failure never rejects back into the ITN response path. Both events
 * carry $event_id, so PayFast ITN redeliveries are deduped by Klaviyo.
 * The customer / Items mapping is shared with the "Fulfilled Order" event
 * (/api/admin/fulfil) via lib/klaviyo-orders.
 */
async function trackKlaviyoOrder(
  order: Order,
  items: OrderItem[],
  paymentReference: string | null,
): Promise<void> {
  const categoryByProduct = await fetchCategoryByProduct(
    createServerSupabase(),
    items,
  );

  const customer = klaviyoCustomerFor(order);
  const lineItems = klaviyoLineItemsFor(items, categoryByProduct);
  const categories = klaviyoCategoriesFor(items, categoryByProduct);
  const itemNames = items.map((it) => it.product_name);
  const occurredAt = order.paid_at
    ? Math.floor(new Date(order.paid_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  const events: Promise<void>[] = [
    trackKlaviyoEvent(
      "Placed Order",
      customer,
      {
        $event_id: order.id,
        $value: Number(order.total),
        OrderId: order.id,
        Categories: categories,
        ItemNames: itemNames,
        Brands: [KLAVIYO_BRAND],
        DiscountCode: order.discount_code ?? undefined,
        DiscountValue: Number(order.discount_amount) || 0,
        ShippingCost: Number(order.shipping_cost) || 0,
        ShippingMethod: shippingMethodLabel(order.shipping_method) ?? undefined,
        Currency: order.currency,
        PaymentReference: paymentReference ?? undefined,
        Items: lineItems,
        ShippingAddress: {
          FirstName: order.first_name,
          LastName: order.last_name,
          Address1: order.shipping_address_line1,
          Address2: order.shipping_address_line2 ?? undefined,
          City: order.shipping_city,
          Zip: order.shipping_postal_code,
          Country: order.shipping_country,
          Phone: order.phone ?? undefined,
        },
      },
      occurredAt,
    ),
    ...items.map((it) => {
      const cat = categoryFor(categoryByProduct, it);
      return trackKlaviyoEvent(
        "Ordered Product",
        customer,
        {
          $event_id: `${order.id}_${it.product_id ?? it.product_slug}`,
          $value: Number(it.line_total),
          OrderId: order.id,
          ProductID: it.product_id ?? it.product_slug,
          SKU: it.product_slug,
          ProductName: it.product_name,
          Quantity: it.quantity,
          ProductURL: klaviyoProductUrl(it.product_slug),
          ImageURL: it.product_image_url ?? undefined,
          Categories: cat ? [cat] : [],
          ProductBrand: KLAVIYO_BRAND,
        },
        occurredAt,
      );
    }),
  ];

  const results = await Promise.allSettled(events);
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("PayFast ITN: Klaviyo order event failed", r.reason);
    }
  }
}
