/**
 * Order status endpoint — lets the success page confirm a payment actually
 * completed before firing analytics conversion events.
 *
 * Why it exists:
 * The GA4 / Meta `purchase` events used to fire as soon as the browser landed
 * on /checkout/success?order=<id>. But that URL is the PayFast `return_url` —
 * a customer-controlled browser redirect that proves nothing about payment.
 * The authoritative signal is the ITN handler flipping the order to `paid`.
 * This route exposes just enough of the order (status + line items + total)
 * for the client to fire `purchase` only once the order is genuinely paid,
 * and with the server-priced total rather than the unverified cart.
 *
 * Access model:
 * The order id is an unguessable UUID and acts as the bearer token — the same
 * trust model the success page already relies on. We deliberately return NO
 * PII (no email, name, address, phone): only what the conversion event needs.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import type { Order, OrderItem } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Matches a v4-style UUID. Cheap guard so we don't hit the DB for obvious junk.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || !UUID_RE.test(id)) {
    return Response.json({ error: "invalid_order_id" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, currency, total")
    .eq("id", id)
    .single<Pick<Order, "id" | "status" | "currency" | "total">>();

  if (error || !order) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Only surface line items once the order is paid — there's no reason for the
  // client to see them otherwise, and `purchase` is the only consumer.
  let items: Array<{
    item_id: string;
    item_name: string;
    item_variant?: string;
    price: number;
    quantity: number;
  }> = [];

  if (order.status === "paid") {
    const { data: rows } = await supabase
      .from("order_items")
      .select("product_id, product_name, unit_price, quantity")
      .eq("order_id", id)
      .returns<Pick<OrderItem, "product_id" | "product_name" | "unit_price" | "quantity">[]>();

    items = (rows ?? []).map((r) => ({
      item_id: r.product_id ?? "",
      item_name: r.product_name,
      price: Number(r.unit_price),
      quantity: r.quantity,
    }));
  }

  return Response.json(
    {
      orderId: order.id,
      status: order.status,
      currency: order.currency,
      total: Number(order.total),
      items,
    },
    { status: 200 },
  );
}
