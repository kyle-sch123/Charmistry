/**
 * Checkout-cancel endpoint — marks an in-flight order as `cancelled` when the
 * customer backs out at the PayFast hosted page.
 *
 * Why it exists:
 * PayFast's standard integration does NOT reliably send a cancellation ITN, so
 * an order created at checkout stays `pending` forever once the customer bails.
 * PayFast does, however, redirect them to our `cancel_url`
 * (`/checkout/cancelled?order=<id>`). This route is what that page calls so the
 * abandoned order gets a terminal status instead of masquerading as a real,
 * unfulfilled `pending` order.
 *
 * Trust model (mirrors /api/orders/[id]/status):
 * The order id is an unguessable UUID and acts as the bearer token. This is a
 * customer-driven browser signal, NOT authoritative — so the update is hard
 * guarded to `status='pending'`. It can therefore ONLY ever move a pending
 * order to cancelled; it can never downgrade a `paid` order, and a caller who
 * somehow guesses a UUID can at worst cancel an order that was already
 * abandoned. The PayFast ITN remains the source of truth: a genuine COMPLETE
 * ITN still rescues a cancelled order to `paid` (see /api/payfast/notify).
 *
 * Always responds 200 with a neutral body so the endpoint leaks nothing about
 * whether the order exists or what state it was in.
 */

import { createServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Matches a v4-style UUID. Cheap guard so we don't hit the DB for obvious junk.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let orderId: string | undefined;
  try {
    const body = (await request.json()) as { orderId?: string };
    orderId = typeof body.orderId === "string" ? body.orderId.trim() : undefined;
  } catch {
    // Fall through — treated as a missing id below.
  }

  if (!orderId || !UUID_RE.test(orderId)) {
    return Response.json({ ok: true }, { status: 200 });
  }

  const supabase = createServerSupabase();
  // Only ever pending -> cancelled. The guard makes this idempotent and means
  // a paid/failed/already-cancelled order is left exactly as it is.
  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .eq("status", "pending");

  if (error) {
    console.error("Checkout cancel: order update failed", { orderId, error });
    // Still 200 — the browser can't do anything useful with the error and the
    // order is harmless left pending; the merchant can reconcile if needed.
    return Response.json({ ok: true }, { status: 200 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
