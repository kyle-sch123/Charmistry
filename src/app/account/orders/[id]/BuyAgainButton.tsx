/**
 * "Order again" — re-adds a past order's items to the cart at CURRENT prices
 * and stock. Products are refetched live (order_items only hold a snapshot),
 * the cart store clamps quantities to what's available, and anything sold
 * out or discontinued is reported instead of silently dropped. addItem opens
 * the cart drawer, so success needs no further navigation.
 */

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/stores/cart";
import type { Product } from "@/types";

interface BuyAgainItem {
  product_id: string | null;
  product_name: string;
  quantity: number;
}

export default function BuyAgainButton({ items }: { items: BuyAgainItem[] }) {
  const addItem = useCart((s) => s.addItem);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function buyAgain() {
    if (busy) return;
    setBusy(true);
    setNotice(null);

    try {
      const ids = items
        .map((i) => i.product_id)
        .filter((id): id is string => Boolean(id));
      const { data: products } = ids.length
        ? await supabase
            .from("products")
            .select("*")
            .in("id", ids)
            .returns<Product[]>()
        : { data: [] as Product[] };

      const byId = new Map((products ?? []).map((p) => [p.id, p]));
      const skipped: string[] = [];
      let added = 0;

      for (const item of items) {
        const product = item.product_id ? byId.get(item.product_id) : undefined;
        if (!product || !product.in_stock || product.quantity <= 0) {
          skipped.push(item.product_name);
          continue;
        }
        addItem(product, item.quantity);
        added += 1;
      }

      if (skipped.length > 0) {
        setNotice(
          added > 0
            ? `Added to your bag — but no longer available: ${skipped.join(", ")}.`
            : `Sorry, ${skipped.join(", ")} ${skipped.length === 1 ? "is" : "are"} no longer available.`,
        );
      }
    } catch {
      setNotice("Something went wrong adding these to your bag. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={buyAgain}
        disabled={busy}
        className="px-8 py-3 border border-ink text-[11px] tracking-[0.2em] uppercase font-body hover:bg-ink hover:text-paper transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? "Adding…" : "Order these again"}
      </button>
      {notice && (
        <p className="text-[11px] text-ink/55 leading-relaxed">{notice}</p>
      )}
    </div>
  );
}
