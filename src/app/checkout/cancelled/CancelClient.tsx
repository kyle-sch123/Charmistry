/**
 * CancelClient — tells the server to mark the order `cancelled` when the
 * customer lands on the payment-cancelled page.
 *
 * Why this exists:
 * `/checkout/cancelled?order=<id>` is the PayFast `cancel_url`. PayFast does
 * not reliably fire a cancellation ITN, so without this the order would sit at
 * `pending` indefinitely and look like a real, unfulfilled sale. This posts the
 * order id (once) to /api/checkout/cancel, which flips it pending -> cancelled.
 *
 * Deliberately does NOT clear the cart — the page copy promises "your bag is
 * saved" so the shopper can retry. Best-effort and silent: a failed call just
 * leaves the order pending, which is harmless.
 */

"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

export default function CancelClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const sent = useRef(false);

  useEffect(() => {
    if (!orderId || sent.current) return;
    sent.current = true;

    fetch("/api/checkout/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
      keepalive: true,
    }).catch(() => {
      // Best-effort — the order simply stays pending if this fails.
    });
  }, [orderId]);

  return null;
}
