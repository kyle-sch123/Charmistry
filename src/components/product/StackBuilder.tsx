/**
 * StackBuilder — the interactive "Create Your Own Stack" module on the PDP,
 * shown between the product detail and the reviews.
 *
 * Three slots (one per MIX_MATCH_STACK category: necklace, earrings, bracelet)
 * each hold a swappable candidate piece. Keeping all three ticked prices the
 * set at percentOff below the sum — the SAME discount resolveBundleDiscount
 * grants at checkout, so the promise here is exactly what's charged. When the
 * viewed product belongs to one of the slots it's pinned there as "This item".
 *
 * Candidates arrive from the server (getStackCandidates: purchasable pieces,
 * best sellers first, one row per piece). The module renders nothing unless
 * every slot has at least one candidate — an incomplete stack can't earn the
 * discount and would just be noise.
 */

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { ProductWithCategory } from "@/types";
import { useCart, selectCartSubtotal } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";
import { MIX_MATCH_STACK } from "@/lib/bundles";
import { trackAddToCart } from "@/lib/gtag";
import { trackAddToCart as fbTrackAddToCart } from "@/lib/fpixel";
import {
  trackAddedToCart as klTrackAddedToCart,
  cartLinesToKlaviyoItems,
} from "@/lib/klaviyo-client";

interface Props {
  /** The product whose page we're on — pinned into its slot when it fits. */
  product: ProductWithCategory;
  /** Purchasable candidates keyed by category slug (see getStackCandidates). */
  candidates: Record<string, ProductWithCategory[]>;
}

const pieceKey = (p: ProductWithCategory) =>
  `${p.name.trim().toLowerCase()}|${p.category_id ?? ""}`;

const purchasable = (p: ProductWithCategory) =>
  p.in_stock && (p.quantity ?? 0) > 0;

export default function StackBuilder({ product, candidates }: Props) {
  // One ordered candidate list per stack category. The viewed product leads
  // its own category's list (replacing any row of the same piece) so the slot
  // defaults to "This item", exactly like the classic bought-together module.
  const slots = useMemo(
    () =>
      MIX_MATCH_STACK.categories.map((categorySlug) => {
        let items = candidates[categorySlug] ?? [];
        if (product.categories?.slug === categorySlug && purchasable(product)) {
          items = [
            product,
            ...items.filter((p) => pieceKey(p) !== pieceKey(product)),
          ];
        }
        return { categorySlug, items };
      }),
    [candidates, product],
  );

  const [indexBySlot, setIndexBySlot] = useState<number[]>(() =>
    slots.map(() => 0),
  );
  const [checked, setChecked] = useState<boolean[]>(() =>
    slots.map(() => true),
  );
  const [justAdded, setJustAdded] = useState(false);

  const addItem = useCart((s) => s.addItem);

  // Guard AFTER the hooks so React sees a stable hook order.
  if (slots.some((s) => s.items.length === 0)) return null;

  const active = slots.map(
    (slot, i) => slot.items[indexBySlot[i] % slot.items.length],
  );
  const selection = active.filter((_, i) => checked[i]);
  const subtotal = selection.reduce((acc, p) => acc + Number(p.price), 0);
  const fullStack = selection.length === slots.length;
  const saving = fullStack
    ? Number(((subtotal * MIX_MATCH_STACK.percentOff) / 100).toFixed(2))
    : 0;

  const swap = (slot: number, dir: -1 | 1) => {
    setIndexBySlot((cur) =>
      cur.map((idx, i) => {
        if (i !== slot) return idx;
        const len = slots[i].items.length;
        return (idx + dir + len) % len;
      }),
    );
  };

  const toggle = (slot: number) =>
    setChecked((cur) => cur.map((c, i) => (i === slot ? !c : c)));

  const handleAddStack = () => {
    if (selection.length === 0) return;
    for (const p of selection) {
      addItem(p, 1);
      const item = {
        item_id: p.id,
        item_name: p.name,
        item_category: p.categories?.name ?? undefined,
        item_variant: p.metal ?? undefined,
        price: Number(p.price),
        quantity: 1,
        slug: p.slug,
        image_url: p.image_url,
      };
      trackAddToCart(item);
      fbTrackAddToCart(item);
      // Zustand updates synchronously, so the cart snapshot after each add is
      // accurate — same pattern as ProductDetail.handleAdd.
      const cartState = useCart.getState();
      klTrackAddedToCart(
        item,
        cartLinesToKlaviyoItems(cartState.lines),
        selectCartSubtotal(cartState),
      );
    }
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  };

  return (
    <section
      id="stack-builder"
      aria-labelledby="stack-builder-heading"
      className="mt-24 border border-ink/10 bg-paper-warm/50 p-6 md:p-10 scroll-mt-28"
    >
      <p className="text-[11px] tracking-[0.25em] uppercase text-gold-dark font-body mb-2">
        Stack &amp; Save · {MIX_MATCH_STACK.percentOff}% off
      </p>
      <h2
        id="stack-builder-heading"
        className="font-display text-3xl md:text-4xl font-light"
      >
        Create your own stack
      </h2>
      <p className="mt-3 font-body text-[14px] leading-relaxed text-ink/65 max-w-xl">
        Pick a necklace, earrings and a bracelet — keep all three and{" "}
        {MIX_MATCH_STACK.percentOff}% comes off the set automatically at
        checkout.
      </p>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Slots */}
        <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:gap-4 items-start">
          {slots.map((slot, i) => {
            const piece = active[i];
            const isThisItem = piece.id === product.id;
            const included = checked[i];
            const categoryName =
              piece.categories?.name ?? slot.categorySlug;

            return (
              <div key={slot.categorySlug} className="contents">
                {i > 0 && (
                  <span
                    className="justify-self-center self-center font-display text-2xl text-ink/35 select-none"
                    aria-hidden
                  >
                    +
                  </span>
                )}
                <div className="group/slot">
                  <div
                    className={`relative aspect-square overflow-hidden bg-stone transition-opacity duration-300 ${
                      included ? "" : "opacity-40"
                    }`}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={piece.id}
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        {piece.image_url && (
                          <Image
                            src={piece.image_url}
                            alt={piece.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, 30vw"
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Include / exclude */}
                    <label className="absolute top-2.5 left-2.5 z-10 flex items-center justify-center w-7 h-7 bg-paper/90 border border-ink/20 cursor-pointer hover:border-ink transition-colors">
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={() => toggle(i)}
                        className="w-3.5 h-3.5 accent-ink cursor-pointer"
                        aria-label={`Include ${piece.name} in the stack`}
                      />
                    </label>

                    {/* Swap candidates */}
                    {slot.items.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => swap(i, -1)}
                          aria-label={`Previous ${categoryName.toLowerCase()} option`}
                          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center bg-paper/85 text-ink/70 hover:text-ink hover:bg-paper border border-ink/15 transition-colors cursor-pointer opacity-0 group-hover/slot:opacity-100 focus-visible:opacity-100"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() => swap(i, 1)}
                          aria-label={`Next ${categoryName.toLowerCase()} option`}
                          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center bg-paper/85 text-ink/70 hover:text-ink hover:bg-paper border border-ink/15 transition-colors cursor-pointer opacity-0 group-hover/slot:opacity-100 focus-visible:opacity-100"
                        >
                          ›
                        </button>
                      </>
                    )}
                  </div>

                  <p className="mt-3 text-[10px] tracking-[0.2em] uppercase text-ink/50 font-body">
                    {categoryName}
                    {isThisItem && (
                      <span className="text-gold-dark"> · This item</span>
                    )}
                    {slot.items.length > 1 && (
                      <span className="text-ink/35">
                        {" "}
                        · {(indexBySlot[i] % slot.items.length) + 1}/
                        {slot.items.length}
                      </span>
                    )}
                  </p>
                  <Link
                    href={`/products/${piece.slug}`}
                    className="mt-1 block font-display text-lg leading-snug text-ink hover:text-ink-secondary transition-colors truncate"
                  >
                    {piece.name}
                  </Link>
                  <p className="mt-0.5 font-body text-sm text-ink/80">
                    {formatPrice(piece.price)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="lg:w-72 shrink-0 border-t border-ink/10 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <p className="text-[10px] tracking-[0.2em] uppercase text-ink/50 font-body">
            Total for {selection.length}{" "}
            {selection.length === 1 ? "piece" : "pieces"}
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            {fullStack && (
              <span className="font-body text-sm text-ink/45 line-through">
                {formatPrice(subtotal)}
              </span>
            )}
            <span className="font-display text-3xl">
              {formatPrice(Math.max(0, subtotal - saving))}
            </span>
          </div>
          {fullStack ? (
            <p className="mt-1.5 font-body text-[12px] text-gold-dark">
              You save {formatPrice(saving)} ({MIX_MATCH_STACK.percentOff}%
              off), applied automatically at checkout.
            </p>
          ) : (
            <p className="mt-1.5 font-body text-[12px] text-ink/55">
              Keep all {slots.length} pieces to save{" "}
              {MIX_MATCH_STACK.percentOff}%.
            </p>
          )}

          <button
            type="button"
            onClick={handleAddStack}
            disabled={selection.length === 0}
            className="relative mt-5 w-full h-12 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer overflow-hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={justAdded ? "added" : `add-${selection.length}`}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -16, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {justAdded
                  ? "Added to bag ✓"
                  : selection.length === 0
                    ? "Select pieces"
                    : selection.length === slots.length
                      ? `Add all ${slots.length} to bag`
                      : `Add ${selection.length} to bag`}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </section>
  );
}
