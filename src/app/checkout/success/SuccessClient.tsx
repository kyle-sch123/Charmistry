/**
 * SuccessClient — clears the cart and closes the drawer when the user
 * lands on the success page with an ?order= param. Without the param the
 * cart is left intact so a stray visit to /checkout/success doesn't wipe
 * a returning shopper's cart.
 */

"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/stores/cart";

// Clears the cart once the user lands on the success page WITH an order param.
// The webhook is the source of truth for order state — this is just UX.
// Without an order param we leave the cart alone (avoids accidental wipes
// from hostile links or stale bookmarks).
export default function SuccessClient() {
  const clear = useCart((s) => s.clear);
  const closeCart = useCart((s) => s.closeCart);
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");

  useEffect(() => {
    if (!orderId) return;
    clear();
    closeCart();
  }, [clear, closeCart, orderId]);

  return null;
}
