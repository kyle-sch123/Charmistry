/**
 * SuccessClient — clears the cart and closes the drawer when the user
 * lands on the success page with an ?order= param. Without the param the
 * cart is left intact so a stray visit to /checkout/success doesn't wipe
 * a returning shopper's cart.
 */

"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCart, selectCartSubtotal } from "@/stores/cart";
import { trackPurchase } from "@/lib/gtag";
import { trackPurchase as fbTrackPurchase } from "@/lib/fpixel";

// Clears the cart once the user lands on the success page WITH an order param.
// The webhook is the source of truth for order state — this is just UX.
// Without an order param we leave the cart alone (avoids accidental wipes
// from hostile links or stale bookmarks).
export default function SuccessClient() {
  const clear = useCart((s) => s.clear);
  const closeCart = useCart((s) => s.closeCart);
  const lines = useCart((s) => s.lines);
  const subtotal = useCart(selectCartSubtotal);
  const hasHydrated = useCart((s) => s.hasHydrated);
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const tracked = useRef(false);

  useEffect(() => {
    // Wait for the persisted cart to rehydrate before reading `lines`. On a
    // hard load (e.g. the PayFast redirect) the effect would otherwise run
    // against an empty cart, fire no purchase event, and then clear() —
    // permanently losing the conversion for both GA and the Meta Pixel.
    if (!orderId || !hasHydrated || tracked.current) return;
    tracked.current = true;
    if (lines.length > 0) {
      const items = lines.map((l) => ({
        item_id: l.id,
        item_name: l.name,
        item_variant: l.metal ?? undefined,
        price: l.price,
        quantity: l.quantity,
      }));
      trackPurchase(orderId, items, subtotal);
      fbTrackPurchase(orderId, items, subtotal);
    }
    clear();
    closeCart();
  }, [clear, closeCart, orderId, hasHydrated, lines, subtotal]);

  return null;
}
