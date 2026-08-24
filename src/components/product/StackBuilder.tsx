/**
 * StackBuilder — the interactive "Create Your Own Stack" module on the PDP,
 * shown between the product detail and the reviews.
 *
 * Three slots (one per MIX_MATCH_STACK category: necklace, earrings, bracelet)
 * each hold a swappable candidate piece. Keeping all three ticked earns the
 * stack discount, and the saving shown is priced by resolveBundleDiscount —
 * the SAME resolver /api/checkout charges — so the promise here is exactly
 * what's honoured. When the viewed product belongs to one of the slots it's
 * pinned there as "This item".
 *
 * Layout: three square slots side by side reads well on a desktop grid but
 * stacked into roughly a screen and a half on a phone, which buried the
 * summary and the add button. Below `sm` the slots become a snap-scrolling
 * row instead — one card at a time with the next peeking — so the module
 * costs one card's height at any width. The swap arrows are hover-revealed on
 * pointer devices but always visible (and touch-sized) on the scroller, since
 * there is no hover to reveal them with.
 *
 * Candidates arrive from the server (getStackCandidates: purchasable pieces,
 * best sellers first, EVERY metal variant row). A Gold/Silver toggle filters
 * the candidate pool by metal; within a view the rows are consolidated to one
 * tile per piece (pickPieceRepresentatives — the shop-grid rule) and capped.
 * The module renders nothing unless every slot has at least one candidate in
 * the unfiltered view — an incomplete stack can't earn the perk and would just
 * be noise; the toggle only offers metals every slot can satisfy.
 */

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { MetalType, ProductWithCategory } from "@/types";
import { useCart, selectCartSubtotal } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";
import { MIX_MATCH_STACK, resolveBundleDiscount } from "@/lib/bundles";
import { pickPieceRepresentatives } from "@/lib/pieces";
import { metalLabels, metalSwatch } from "@/lib/metals";
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

/** Metals the toggle can offer — the two the catalogue actually stocks. */
const METAL_CHOICES: MetalType[] = ["gold", "silver"];

const MAX_PER_SLOT = 6;

export default function StackBuilder({ product, candidates }: Props) {
  // Metals for which EVERY slot has at least one purchasable candidate — a
  // metal that would leave a slot empty is never offered, so choosing one can
  // never break the stack (or hide the module mid-interaction).
  const availableMetals = useMemo(
    () =>
      METAL_CHOICES.filter((metal) =>
        MIX_MATCH_STACK.categories.every(
          (categorySlug) =>
            (candidates[categorySlug] ?? []).some((p) => p.metal === metal) ||
            (product.categories?.slug === categorySlug &&
              purchasable(product) &&
              product.metal === metal),
        ),
      ),
    [candidates, product],
  );

  const [metalFilter, setMetalFilter] = useState<"all" | MetalType>("all");

  // One ordered candidate list per stack category, for the chosen metal view.
  // Variant rows are filtered by metal first, then consolidated to one tile
  // per piece (owner's shop_featured pick wins — the shop-grid rule) and
  // capped. The viewed product leads its own category's list (replacing any
  // row of the same piece) so the slot defaults to "This item", exactly like
  // the classic bought-together module — unless it doesn't match the chosen
  // metal, in which case the view is a plain browse.
  const slots = useMemo(
    () =>
      MIX_MATCH_STACK.categories.map((categorySlug) => {
        let rows = candidates[categorySlug] ?? [];
        if (metalFilter !== "all") {
          rows = rows.filter((p) => p.metal === metalFilter);
        }
        let items = pickPieceRepresentatives(rows).slice(0, MAX_PER_SLOT);
        if (
          product.categories?.slug === categorySlug &&
          purchasable(product) &&
          (metalFilter === "all" || product.metal === metalFilter)
        ) {
          items = [
            product,
            ...items.filter((p) => pieceKey(p) !== pieceKey(product)),
          ];
        }
        return { categorySlug, items };
      }),
    [candidates, product, metalFilter],
  );

  const [indexBySlot, setIndexBySlot] = useState<number[]>(() =>
    slots.map(() => 0),
  );
  const [checked, setChecked] = useState<boolean[]>(() =>
    slots.map(() => true),
  );
  const [justAdded, setJustAdded] = useState(false);

  const addItem = useCart((s) => s.addItem);

  const changeMetalFilter = (metal: "all" | MetalType) => {
    setMetalFilter(metal);
    // Restart every slot at its best-ranked candidate — the old indices point
    // into a differently-filtered list and would land on arbitrary pieces.
    setIndexBySlot(slots.map(() => 0));
  };

  // Guard AFTER the hooks so React sees a stable hook order. Judged on the
  // unfiltered pool (metalFilter only ever narrows to metals every slot can
  // satisfy, so a chosen metal can never empty a slot this guard would miss).
  if (slots.some((s) => s.items.length === 0)) return null;

  const active = slots.map(
    (slot, i) => slot.items[indexBySlot[i] % slot.items.length],
  );
  const selection = active.filter((_, i) => checked[i]);
  const subtotal = selection.reduce((acc, p) => acc + Number(p.price), 0);
  const fullStack = selection.length === slots.length;

  // Price the saving with the resolver checkout uses rather than re-doing the
  // percentage here — the figure quoted is then the figure charged, by
  // construction. Cheap and pure, so no memo (and it can't be one: the slot
  // guard above returns before this point).
  const stackDiscount = resolveBundleDiscount(
    selection.map((piece) => ({
      slug: piece.slug,
      category: piece.categories?.slug,
      price: Number(piece.price),
      quantity: 1,
    })),
  );

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
        {MIX_MATCH_STACK.percentOff}% comes off them, automatically at
        checkout.
      </p>

      {/* Gold / Silver view — only metals every slot can satisfy are offered */}
      {availableMetals.length > 0 && (
        <div
          className="mt-6 flex items-center gap-2"
          role="radiogroup"
          aria-label="Filter stack pieces by metal"
        >
          {(["all", ...availableMetals] as const).map((metal) => {
            const selected = metalFilter === metal;
            return (
              <button
                key={metal}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => changeMetalFilter(metal)}
                className={`flex items-center gap-1.5 border px-3.5 py-1.5 text-[10px] tracking-[0.18em] uppercase font-body transition-colors cursor-pointer ${
                  selected
                    ? "border-ink bg-ink text-paper"
                    : "border-ink/20 text-ink/60 hover:border-ink/50 hover:text-ink"
                }`}
              >
                {metal !== "all" && (
                  <span
                    className="w-2.5 h-2.5 rounded-full ring-1 ring-ink/15"
                    style={{ background: metalSwatch[metal] }}
                    aria-hidden
                  />
                )}
                {metal === "all" ? "All metals" : metalLabels[metal]}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Slots */}
        {/* Below sm: a snap-scrolling row, one card per view with the next
            peeking. From sm: the original three-up grid with + separators.
            The negative margin lets cards run to the screen edge while the
            padding keeps the first one aligned with the section's gutter. */}
        <div className="flex-1 items-start -mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scrollbar-none px-6 pb-1 sm:mx-0 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
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
                    className="hidden sm:block justify-self-center self-center font-display text-2xl text-ink/35 select-none"
                    aria-hidden
                  >
                    +
                  </span>
                )}
                <div className="group/slot w-[72%] shrink-0 snap-start sm:w-auto sm:shrink">
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
                            sizes="(max-width: 640px) 72vw, 30vw"
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Include / exclude */}
                    <label className="absolute top-2.5 left-2.5 z-10 flex items-center justify-center w-9 h-9 sm:w-7 sm:h-7 bg-paper/90 border border-ink/20 cursor-pointer hover:border-ink transition-colors">
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
                          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-7 sm:h-7 flex items-center justify-center bg-paper/85 text-ink/70 hover:text-ink hover:bg-paper border border-ink/15 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover/slot:opacity-100 sm:focus-visible:opacity-100"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() => swap(i, 1)}
                          aria-label={`Next ${categoryName.toLowerCase()} option`}
                          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-7 sm:h-7 flex items-center justify-center bg-paper/85 text-ink/70 hover:text-ink hover:bg-paper border border-ink/15 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover/slot:opacity-100 sm:focus-visible:opacity-100"
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
            <span className="font-display text-3xl">
              {formatPrice(
                stackDiscount ? subtotal - stackDiscount.amount : subtotal,
              )}
            </span>
            {stackDiscount && (
              <span className="font-body text-sm text-ink/40 line-through">
                {formatPrice(subtotal)}
              </span>
            )}
          </div>
          {fullStack && stackDiscount ? (
            <p className="mt-1.5 font-body text-[12px] text-gold-dark">
              {MIX_MATCH_STACK.percentOff}% off — you save{" "}
              {formatPrice(stackDiscount.amount)}, applied automatically at
              checkout.
            </p>
          ) : (
            <p className="mt-1.5 font-body text-[12px] text-ink/55">
              Keep all {slots.length} pieces to unlock{" "}
              {MIX_MATCH_STACK.percentOff}% off.
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
