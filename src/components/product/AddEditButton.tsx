/**
 * "Add to Bag" for a set of products — the bundle action shared by the
 * Everyday Edit and The Daily Affair, and also used for the single pieces on
 * the Daily Affair rail (a one-product set).
 *
 * Adds every product passed in one click. The bundle price is not a code the
 * shopper types: it is detected from the cart contents by resolveBundleDiscount
 * and applied automatically in CheckoutClient and, as the authority, in
 * /api/checkout. So there is nothing to stash or carry over here — getting the
 * pieces into the bag is all that's needed for the saving.
 *
 * Analytics mirror ProductCard.handleAdd so a bundle add is tracked the same as
 * N individual adds: GA + Meta add_to_cart per piece, one Klaviyo Added to
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
  /** "solid" is the primary edit CTA; "outline" is the quieter per-piece add. */
  variant?: "solid" | "outline";
  /** Edit CTAs span their column; a single piece sits inline next to a price. */
  fullWidth?: boolean;
  /**
   * Force the sold-out state even when a product row says otherwise — used by
   * The Daily Affair before its catalogue rows exist, where `products` is empty
   * but the button should read "Coming soon" rather than "Unavailable".
   */
  disabledLabel?: string;
  className?: string;
}

const TONES = {
  dark: {
    solid: "bg-ink text-paper hover:bg-ink-secondary",
    outline:
      "border border-ink/30 text-ink hover:bg-ink hover:text-paper hover:border-ink",
    sheen: "via-gold/25",
    note: "text-ink/45",
    focus: "focus-visible:outline-ink",
  },
  light: {
    solid: "bg-gold text-obsidian hover:bg-gold-light",
    outline:
      "border border-gold/60 text-gold hover:bg-gold hover:text-obsidian hover:border-gold",
    sheen: "via-white/40",
    note: "text-ivory/45",
    focus: "focus-visible:outline-ivory",
  },
} as const;

export default function AddEditButton({
  products,
  label,
  showNote = false,
  tone = "dark",
  variant = "solid",
  fullWidth = true,
  disabledLabel,
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
        className={`group relative min-h-11 overflow-hidden text-[11px] tracking-[0.25em] uppercase font-body transition-colors duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-[3px] ${t.focus} ${
          fullWidth ? "w-full py-4" : "px-7 py-3.5"
        } ${t[variant]}`}
      >
        {/* Sheen sweep on hover */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-transparent transition-transform duration-700 group-hover:translate-x-full ${t.sheen}`}
        />
        <span className="relative">
          {soldOut
            ? (disabledLabel ?? "Currently Unavailable")
            : added
              ? "Added to Bag ✓"
              : label}
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
