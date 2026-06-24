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

// Clears the cart once the user lands on the success page WITH an order param.
// The webhook is the source of truth for order state — this is just UX.
// Without an order param we leave the cart alone (avoids accidental wipes
// from hostile links or stale bookmarks).
export default function SuccessClient() {
  const clear = useCart((s) => s.clear);
  const closeCart = useCart((s) => s.closeCart);
  const lines = useCart((s) => s.lines);
  const subtotal = useCart(selectCartSubtotal);
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const tracked = useRef(false);

  useEffect(() => {
    if (!orderId || tracked.current) return;
    tracked.current = true;
    if (lines.length > 0) {
      trackPurchase(
        orderId,
        lines.map((l) => ({
          item_id: l.id,
          item_name: l.name,
          item_variant: l.metal ?? undefined,
          price: l.price,
          quantity: l.quantity,
        })),
        subtotal,
      );
    }
    clear();
    closeCart();
  }, [clear, closeCart, orderId, lines, subtotal]);

  return null;
}
