/**
 * useEmailSubscribe — POSTs to /api/subscribe and exposes status + the
 * generated discount code. Returned `subscribe` resolves with the final
 * status so callers can act on success (e.g. clear the input) without
 * triggering React's "setState in effect" warning.
 */

"use client";

import { useState } from "react";

export type SubscribeStatus = "idle" | "loading" | "success" | "error" | "duplicate";

export function useEmailSubscribe() {
  const [status, setStatus] = useState<SubscribeStatus>("idle");
  const [discountCode, setDiscountCode] = useState<string | null>(null);

  async function subscribe(email: string): Promise<SubscribeStatus> {
    setStatus("loading");
    // Clear any stale code from a prior attempt so we don't show last run's
    // code if the current run resolves to duplicate/error.
    setDiscountCode(null);
    let result: SubscribeStatus;
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.status === 409) {
        result = "duplicate";
      } else if (!res.ok) {
        result = "error";
      } else {
        setDiscountCode(data.discountCode ?? null);
        result = "success";
      }
    } catch {
      result = "error";
    }
    setStatus(result);
    return result;
  }

  return { status, discountCode, subscribe };
}
