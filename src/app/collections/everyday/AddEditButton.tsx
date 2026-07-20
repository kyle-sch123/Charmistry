/**
 * "Add the Edit to Bag" — the bundle action for the Everyday Edit collection.
 *
 * Adds all pieces of the edit to the cart in one click. The bundle price is not
 * a code the shopper types: it is detected from the cart contents by
 * resolveBundleDiscount and applied automatically in CheckoutClient and, as the
 * authority, in /api/checkout. So there is nothing to stash or carry over here —
 * getting the five pieces into the bag is all that's needed for the R110 saving.
 *
 * Analytics mirror ProductCard.handleAdd so a bundle add is tracked the same as
 * five individual adds: GA + Meta add_to_cart per piece, one Klaviyo Added to
 * Cart reflecting the whole bag.
 */

"use client";

import { useState } from "react";
import type { ProductWithCategory } from "@/types";
import { useCart, selectCartSubtotal } from "@/stores/cart";
import { trackAddToCart } from "@/lib/gtag";
import { trackAddToCart as fbTrackAddToCart } from "@/lib/fpixel";
import {
  trackAddedToCart as klTrackAddedToCart,
  cartLinesToKlaviyoItems,
} from "@/lib/klaviyo-client";

interface AddEditButtonProps {
  products: ProductWithCategory[];
  label: string;
  /** Show the reassuring "bundle applied at checkout" line under the button. */
  showNote?: boolean;
  /** "dark" = ink button for light backgrounds; "light" = gold button for dark. */
  tone?: "dark" | "light";
  className?: string;
}

const TONES = {
  dark: {
    button: "bg-ink text-paper hover:bg-ink-secondary",
    sheen: "via-gold/25",
    note: "text-ink/45",
  },
  light: {
    button: "bg-gold text-obsidian hover:bg-gold-light",
    sheen: "via-white/40",
    note: "text-ivory/45",
  },
} as const;

export default function AddEditButton({
  products,
  label,
  showNote = false,
  tone = "dark",
  className = "",
}: AddEditButtonProps) {
  const addItem = useCart((s) => s.addItem);
  const openCart = useCart((s) => s.openCart);
  const [added, setAdded] = useState(false);

  const soldOut =
    products.length === 0 ||
    products.every((p) => !p.in_stock || (p.quantity ?? 0) <= 0);

  const handleAdd = () => {
    for (const product of products) {
      addItem(product, 1);
      const item = {
        item_id: product.id,
        item_name: product.name,
        item_category: product.categories?.name ?? undefined,
        price: Number(product.price),
        quantity: 1,
        item_variant: product.metal ?? undefined,
        slug: product.slug,
        image_url: product.image_url,
      };
      trackAddToCart(item);
      fbTrackAddToCart(item);
    }

    // One Klaviyo "Added to Cart" for the whole edit — getState() reflects
    // every line just added (Zustand updates synchronously).
    const cartState = useCart.getState();
    const last = products[products.length - 1];
    if (last) {
      klTrackAddedToCart(
        {
          item_id: last.id,
          item_name: last.name,
          item_category: last.categories?.name ?? undefined,
          price: Number(last.price),
          quantity: 1,
          item_variant: last.metal ?? undefined,
          slug: last.slug,
          image_url: last.image_url,
        },
        cartLinesToKlaviyoItems(cartState.lines),
        selectCartSubtotal(cartState),
      );
    }

    openCart();
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2400);
  };

  const t = TONES[tone];

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleAdd}
        disabled={soldOut}
        className={`group relative w-full overflow-hidden py-4 text-[11px] tracking-[0.25em] uppercase font-body transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${t.button}`}
      >
        {/* Sheen sweep on hover */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-transparent transition-transform duration-700 group-hover:translate-x-full ${t.sheen}`}
        />
        <span className="relative">
          {soldOut ? "Currently Unavailable" : added ? "Added to Bag ✓" : label}
        </span>
      </button>

      {showNote && !soldOut && (
        <p
          className={`mt-3 text-center text-[10px] tracking-[0.18em] uppercase font-body ${t.note}`}
        >
          Bundle price applied automatically at checkout
        </p>
      )}
    </div>
  );
}
