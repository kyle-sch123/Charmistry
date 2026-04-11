"use client";

import { useEffect } from "react";
import { useCart } from "@/stores/cart";

// Clears the cart once the user lands on the success page.
// The ITN webhook is the source of truth for order state — this is just UX.
export default function SuccessClient() {
  const clear = useCart((s) => s.clear);
  const closeCart = useCart((s) => s.closeCart);

  useEffect(() => {
    clear();
    closeCart();
  }, [clear, closeCart]);

  return null;
}
