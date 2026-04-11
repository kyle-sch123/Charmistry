"use client";

import { useState } from "react";

export type SubscribeStatus = "idle" | "loading" | "success" | "error" | "duplicate";

export function useEmailSubscribe() {
  const [status, setStatus] = useState<SubscribeStatus>("idle");
  const [discountCode, setDiscountCode] = useState<string | null>(null);

  async function subscribe(email: string) {
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setStatus("duplicate");
      } else if (!res.ok) {
        setStatus("error");
      } else {
        setDiscountCode(data.discountCode ?? null);
        setStatus("success");
      }
    } catch {
      setStatus("error");
    }
  }

  return { status, discountCode, subscribe };
}
