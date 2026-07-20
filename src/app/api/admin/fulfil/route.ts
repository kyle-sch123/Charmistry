/**
 * Admin fulfilment endpoint — marks a paid order as shipped and fires the
 * Klaviyo "Fulfilled Order" event that powers the shipping-confirmation flow.
 *
 * Why it exists:
 * Fulfilment is manual (there is no courier API integration since Courier Guy
 * was removed), so nothing ever flipped `shipping_status` or recorded tracking
 * details — and Klaviyo never learned an order shipped. This endpoint is the
 * single place that transition happens, driven by the /admin/fulfil page.
 *
 * Auth model:
 * Every request must carry the ADMIN_FULFILMENT_KEY server secret in an
 * `x-admin-key` header. Compared in constant time (SHA-256 both sides so
 * lengths match). Fail-closed: if the env var is unset, everything is 401.
 *
 * GET  — list paid orders not yet shipped (with items + customer notes, where
 *        locker preferences live) for the fulfilment page to render.
 * POST — { orderId, courier, trackingNumber, trackingUrl?, waybillNumber? }
 *        Updates the order (shipped_at is set once and kept stable) and fires
 *        "Fulfilled Order" with tracking properties. Idempotent by design:
 *        re-submitting corrects the stored tracking fields, and the Klaviyo
 *        event is deduped by unique_id (= order id), so a resend after a
 *        Klaviyo failure is safe and a duplicate can't double-mail the
 *        customer. Consequence: a correction submitted AFTER the event landed
 *        updates our DB but does NOT re-send to Klaviyo.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import { isAuthorized } from "@/lib/admin-auth";
import { trackKlaviyoEvent, isKlaviyoConfigured } from "@/lib/klaviyo";
import {
  KLAVIYO_BRAND,
  klaviyoCustomerFor,
  fetchCategoryByProduct,
  klaviyoLineItemsFor,
  klaviyoCategoriesFor,
} from "@/lib/klaviyo-orders";
import { shippingMethodLabel } from "@/lib/shipping";
import type { Order, OrderItem } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Paid orders that still need to ship, newest first, with their line items. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabase();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "paid")
    .not("shipping_status", "in", '("shipped","delivered")')
    .order("paid_at", { ascending: false })
    .limit(50)
    .returns<Order[]>();

  if (error) {
    console.error("Admin fulfil: order list failed", error);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  const orderIds = (orders ?? []).map((o) => o.id);
  let itemsByOrder = new Map<string, OrderItem[]>();
  if (orderIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds)
      .returns<OrderItem[]>();
    if (itemsError) {
      console.error("Admin fulfil: items fetch failed", itemsError);
    }
    itemsByOrder = (items ?? []).reduce((map, it) => {
      const list = map.get(it.order_id) ?? [];
      list.push(it);
      map.set(it.order_id, list);
      return map;
    }, new Map<string, OrderItem[]>());
  }

  return Response.json({
    orders: (orders ?? []).map((o) => ({
      id: o.id,
      shortId: o.id.slice(0, 8).toUpperCase(),
      firstName: o.first_name,
      lastName: o.last_name,
      email: o.email,
      phone: o.phone,
      city: o.shipping_city,
      total: Number(o.total),
      paidAt: o.paid_at,
      shippingMethod: shippingMethodLabel(o.shipping_method),
      notes: o.notes,
      items: (itemsByOrder.get(o.id) ?? []).map((it) => ({
        name: it.product_name,
        quantity: it.quantity,
      })),
    })),
  });
}

interface FulfilBody {
  orderId?: string;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  waybillNumber?: string;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: FulfilBody;
  try {
    body = (await request.json()) as FulfilBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const courier = typeof body.courier === "string" ? body.courier.trim() : "";
  const trackingNumber =
    typeof body.trackingNumber === "string" ? body.trackingNumber.trim() : "";
  const trackingUrl =
    typeof body.trackingUrl === "string" ? body.trackingUrl.trim() : "";
  const waybillNumber =
    typeof body.waybillNumber === "string" ? body.waybillNumber.trim() : "";

  if (!orderId || !UUID_RE.test(orderId)) {
    return Response.json({ error: "invalid_order_id" }, { status: 400 });
  }
  if (!courier) {
    return Response.json({ error: "courier_required" }, { status: 400 });
  }
  if (!trackingNumber) {
    return Response.json({ error: "tracking_number_required" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle<Order>();

  if (fetchError) {
    console.error("Admin fulfil: order fetch failed", fetchError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }
  if (!order) {
    return Response.json({ error: "order_not_found" }, { status: 404 });
  }
  // Only confirmed-paid orders ship. pending/failed/cancelled never fulfil.
  if (order.status !== "paid") {
    return Response.json(
      { error: "order_not_paid", status: order.status },
      { status: 409 },
    );
  }

  // shipped_at is set on the first fulfilment and kept stable on corrections
  // so the recorded ship date doesn't drift.
  const shippedAt = order.shipped_at ?? new Date().toISOString();
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      shipping_status: "shipped",
      courier,
      tracking_number: trackingNumber,
      tracking_url: trackingUrl || null,
      waybill_number: waybillNumber || null,
      shipped_at: shippedAt,
    })
    .eq("id", orderId);

  if (updateError) {
    console.error("Admin fulfil: order update failed", updateError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  // Fire the Klaviyo event AFTER the DB write so a Klaviyo outage can't lose
  // the fulfilment itself; the response reports the event outcome so the admin
  // page can surface a retry (safe — deduped by unique_id).
  let klaviyo: "sent" | "failed" | "skipped" = "skipped";
  if (isKlaviyoConfigured()) {
    try {
      await trackFulfilledOrder(order, {
        courier,
        trackingNumber,
        trackingUrl: trackingUrl || undefined,
        waybillNumber: waybillNumber || undefined,
        shippedAt,
      });
      klaviyo = "sent";
    } catch (err) {
      console.error("Admin fulfil: Klaviyo Fulfilled Order failed", err);
      klaviyo = "failed";
    }
  }

  return Response.json({
    ok: true,
    orderId,
    shippedAt,
    klaviyo,
  });
}

/**
 * Klaviyo "Fulfilled Order" — the metric the shipping-confirmation flow
 * triggers on. Carries the tracking details as event properties so the email
 * template can render {{ event.TrackingNumber }}, {{ event.TrackingURL }},
 * {{ event.Courier }} etc., plus the same Items shape as Placed Order.
 * unique_id = order id: PayFast-style redeliveries / admin resubmits dedupe.
 */
async function trackFulfilledOrder(
  order: Order,
  fulfilment: {
    courier: string;
    trackingNumber: string;
    trackingUrl?: string;
    waybillNumber?: string;
    shippedAt: string;
  },
): Promise<void> {
  const supabase = createServerSupabase();
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .returns<OrderItem[]>();

  const lineItems = items ?? [];
  const categoryByProduct = await fetchCategoryByProduct(supabase, lineItems);

  await trackKlaviyoEvent(
    "Fulfilled Order",
    klaviyoCustomerFor(order),
    {
      $event_id: order.id,
      $value: Number(order.total),
      OrderId: order.id,
      Courier: fulfilment.courier,
      TrackingNumber: fulfilment.trackingNumber,
      TrackingURL: fulfilment.trackingUrl,
      WaybillNumber: fulfilment.waybillNumber,
      ShippingMethod: shippingMethodLabel(order.shipping_method) ?? undefined,
      OrderNotes: order.notes ?? undefined,
      Categories: klaviyoCategoriesFor(lineItems, categoryByProduct),
      ItemNames: lineItems.map((it) => it.product_name),
      Brands: [KLAVIYO_BRAND],
      Currency: order.currency,
      Items: klaviyoLineItemsFor(lineItems, categoryByProduct),
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
    Math.floor(new Date(fulfilment.shippedAt).getTime() / 1000),
  );
}
