/**
 * SuccessClient — clears the cart and fires the analytics `purchase`
 * conversion when the user lands on the success page with an ?order= param.
 *
 * Why this is more than a one-liner:
 * /checkout/success?order=<id> is the PayFast `return_url` — a browser
 * redirect the customer controls, which fires whether or not payment actually
 * completed. Firing `purchase` on arrival (as we used to) reported phantom
 * sales for pending/failed/cancelled payments and stray revisits. The
 * authoritative signal is the order row flipping to `paid`, which the PayFast
 * ITN handler does server-to-server.
 *
 * So we poll /api/orders/<id>/status and fire `purchase` exactly once, only on
 * `paid`, using the server-priced total + items (the cart can't be trusted for
 * value and may already be cleared). The ITN can lag the redirect by a second
 * or two, so we poll for a short window before giving up — under-counting a
 * genuinely-late payment is far safer than counting one that never happened.
 */

"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/stores/cart";
import { trackPurchase } from "@/lib/gtag";
import { trackPurchase as fbTrackPurchase } from "@/lib/fpixel";

// Poll cadence: ~18s total. Long enough to catch a slightly-late ITN, short
// enough that a never-arriving payment doesn't hang the tab indefinitely.
const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 12;

interface StatusResponse {
  status: "pending" | "paid" | "failed" | "cancelled";
  currency: string;
  total: number;
  items: Array<{
    item_id: string;
    item_name: string;
    item_variant?: string;
    price: number;
    quantity: number;
  }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SuccessClient() {
  const clear = useCart((s) => s.clear);
  const closeCart = useCart((s) => s.closeCart);
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const tracked = useRef(false);

  // Clear the cart on arrival with an order param (pure UX — the webhook is
  // the source of truth for order state). Without an order param we leave the
  // cart alone so a stray visit / hostile link can't wipe a returning
  // shopper's cart.
  useEffect(() => {
    if (!orderId) return;
    clear();
    closeCart();
  }, [orderId, clear, closeCart]);

  // Fire the conversion only once the order is confirmed paid.
  useEffect(() => {
    if (!orderId || tracked.current) return;
    tracked.current = true;

    let cancelled = false;

    (async () => {
      for (let attempt = 0; attempt < MAX_POLLS && !cancelled; attempt++) {
        let data: StatusResponse | null = null;
        try {
          const res = await fetch(`/api/orders/${orderId}/status`, {
            cache: "no-store",
          });
          if (res.ok) data = (await res.json()) as StatusResponse;
        } catch {
          // Network blip — fall through to the backoff and retry.
        }

        if (cancelled) return;

        if (data) {
          if (data.status === "paid") {
            if (data.items.length > 0) {
              trackPurchase(orderId, data.items, data.total);
              fbTrackPurchase(orderId, data.items, data.total);
            }
            return;
          }
          // Terminal non-paid states will never become paid — stop polling
          // and fire nothing.
          if (data.status === "failed" || data.status === "cancelled") return;
        }

        await sleep(POLL_INTERVAL_MS);
      }
      // Exhausted the window still pending: do not fire. A late ITN means the
      // sale is simply not attributed here — acceptable vs. a false positive.
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return null;
}
