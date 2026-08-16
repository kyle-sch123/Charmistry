/**
 * Right-side cart drawer — slides in over the page when isOpen is true.
 *
 * Globally mounted from the root layout so any page can call openCart()
 * from the cart store. Body scroll is locked while open, ESC closes, and
 * the backdrop click also closes. Quantity controls bump the line via
 * the cart store (which clamps to maxQuantity from the cached row).
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { ProductWithCategory } from "@/types";
import { useCart, selectCartSubtotal } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";
import { resolveBundleDiscount, resolveShippingPerk } from "@/lib/bundles";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import {
  trackRemoveFromCart,
  trackBeginCheckout,
  trackAddToCart,
} from "@/lib/gtag";
import {
  trackInitiateCheckout as fbTrackInitiateCheckout,
  trackAddToCart as fbTrackAddToCart,
} from "@/lib/fpixel";
import {
  trackAddedToCart as klTrackAddedToCart,
  cartLinesToKlaviyoItems,
} from "@/lib/klaviyo-client";
import { metalLabels, metalSwatch } from "@/lib/metals";
import PaymentIcons from "@/components/icons/PaymentIcons";

export default function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const lines = useCart((s) => s.lines);
  const subtotal = useCart(selectCartSubtotal);
  const closeCart = useCart((s) => s.closeCart);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const removeItem = useCart((s) => s.removeItem);
  const addItem = useCart((s) => s.addItem);

  // "Frequently bought with" — up to 3 best-selling pieces not already in the
  // bag. Keyed on the cart's slug set (not `lines`) so quantity taps don't
  // refetch; adding a suggested piece changes the set, which refetches and
  // drops it from the strip.
  const [suggestions, setSuggestions] = useState<ProductWithCategory[]>([]);
  const cartSlugs = useMemo(
    () =>
      lines
        .map((l) => l.slug)
        .filter(Boolean)
        .sort()
        .join(","),
    [lines],
  );
  useEffect(() => {
    if (!isOpen || cartSlugs === "") return;
    let cancelled = false;
    fetch(`/api/cart/suggestions?exclude=${encodeURIComponent(cartSlugs)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.products)) setSuggestions(d.products);
      })
      // The strip is a bonus — a failed fetch just leaves it empty.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, cartSlugs]);

  const addSuggestion = (p: ProductWithCategory) => {
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
    // Zustand updates synchronously — same pattern as StackBuilder's add.
    const cartState = useCart.getState();
    klTrackAddedToCart(
      item,
      cartLinesToKlaviyoItems(cartState.lines),
      selectCartSubtotal(cartState),
    );
  };

  // Cart-aware bundle (e.g. the Everyday Edit). Same pure resolver the checkout
  // summary and /api/checkout use, so the saving shown here is exactly what's
  // charged. Shown as a line + discounted total so the price isn't a surprise.
  const bundleLines = lines.map((l) => ({
    slug: l.slug,
    category: l.category,
    price: l.price,
    quantity: l.quantity,
  }));
  const bundle = resolveBundleDiscount(bundleLines);
  const bundleAmount = bundle ? Math.min(bundle.amount, subtotal) : 0;
  const bundleTotal = subtotal - bundleAmount;

  // Cart-earned shipping perk — the stacks free the locker method, the
  // Everyday Edit frees any method. Same resolver as checkout/api.
  const shippingPerk = resolveShippingPerk(bundleLines);
  // A stack perk that isn't already covered by the bundle line above gets its
  // own footer row (a stack is not a discount line — nothing to subtract).
  const stackPerk =
    shippingPerk && shippingPerk.code !== bundle?.code ? shippingPerk : null;

  // Free shipping is judged on the discounted total (what the customer actually
  // pays), not the pre-discount subtotal — so the "away from free delivery"
  // figure reconciles with the bundle total shown below, and matches the charge
  // (/api/checkout applies the threshold to the same discounted amount).
  // A cart-earned perk unlocks the bar outright, below the threshold.
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - bundleTotal);
  const thresholdUnlocked = bundleTotal >= FREE_SHIPPING_THRESHOLD;
  const isUnlocked = thresholdUnlocked || shippingPerk != null;
  const progress = isUnlocked
    ? 100
    : Math.min(100, (bundleTotal / FREE_SHIPPING_THRESHOLD) * 100);
  // Over the threshold everything ships free anyway, so only advertise the
  // narrower locker-only wording when the perk is doing the unlocking.
  const unlockedLabel =
    !thresholdUnlocked && shippingPerk?.perk === "locker_only"
      ? "Free locker delivery unlocked"
      : "Free delivery unlocked";

  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCart();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeCart]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="cart-backdrop"
            className="fixed inset-0 z-[60] bg-ink/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCart}
            aria-hidden
          />
          <motion.aside
            key="cart-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Shopping bag"
            className="fixed right-0 top-0 bottom-0 z-[61] w-full sm:max-w-md bg-paper text-ink flex flex-col shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.45 }}
          >
            <header className="flex items-center justify-between px-6 h-20 border-b border-ink/10">
              <div>
                <p className="text-[10px] tracking-[0.25em] uppercase text-ink/50 font-body">
                  Your Bag
                </p>
                <h2 className="font-heading text-2xl">Charmistry</h2>
              </div>
              <button
                onClick={closeCart}
                className="w-10 h-10 flex items-center justify-center text-ink/60 hover:text-ink transition-colors cursor-pointer"
                aria-label="Close cart"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            {lines.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-ink/5 flex items-center justify-center mb-5">
                  <svg className="w-7 h-7 text-ink/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
                  </svg>
                </div>
                <p className="font-display text-xl mb-2">Your bag is empty</p>
                <p className="text-ink/55 text-sm mb-8 max-w-xs">
                  Discover pieces that feel made for you.
                </p>
                <Link
                  href="/shop"
                  onClick={closeCart}
                  className="px-8 py-3 bg-ink text-paper text-xs tracking-[0.15em] uppercase font-body hover:bg-ink-secondary transition-colors"
                >
                  Shop the Collection
                </Link>
              </div>
            ) : (
              <>
                {/* Free shipping progress bar */}
                <div className="px-6 pt-4 pb-3.5 border-b border-ink/10">
                  <div className="flex items-center justify-between mb-2.5">
                    <AnimatePresence mode="wait">
                      {isUnlocked ? (
                        <motion.div
                          key="unlocked"
                          className="flex items-center gap-1.5"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.3 }}
                        >
                          <svg
                            className="w-3 h-3 shrink-0"
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{ color: "var(--color-gold)" }}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                          </svg>
                          <p
                            className="text-[10px] tracking-[0.22em] uppercase font-body"
                            style={{ color: "var(--color-gold)" }}
                          >
                            {unlockedLabel}
                          </p>
                        </motion.div>
                      ) : (
                        <motion.p
                          key="remaining"
                          className="text-[10px] tracking-[0.15em] uppercase font-body text-ink/55"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.3 }}
                        >
                          <span className="text-ink">{formatPrice(remaining)}</span> away from free delivery
                        </motion.p>
                      )}
                    </AnimatePresence>
                    {!isUnlocked && (
                      <span className="text-[10px] font-body text-ink/30 tabular-nums">{formatPrice(FREE_SHIPPING_THRESHOLD)}</span>
                    )}
                  </div>

                  {/* Progress track + the free-delivery milestone circle. The
                      line runs under the circle so the fill visually "reaches"
                      the milestone when delivery unlocks. */}
                  <div className="relative flex h-8 items-center pr-3.5">
                    <div className="relative h-[2px] w-full bg-stone rounded-full overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          background:
                            "linear-gradient(90deg, var(--color-gold-dark), var(--color-gold), var(--color-gold-light))",
                        }}
                        initial={{ width: "0%" }}
                        animate={{ width: `${progress}%` }}
                        transition={{ type: "spring", damping: 28, stiffness: 160, mass: 0.8 }}
                      />
                      {isUnlocked && (
                        <div
                          className="absolute inset-0 animate-shimmer"
                          style={{
                            background:
                              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
                            backgroundSize: "200% 100%",
                          }}
                        />
                      )}
                    </div>
                    <div
                      className={`absolute right-0 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-500 ${
                        isUnlocked
                          ? "border-transparent text-paper shadow-[0_2px_10px_rgba(201,168,76,0.45)]"
                          : "border-ink/20 bg-paper text-ink/35"
                      }`}
                      style={
                        isUnlocked
                          ? {
                              background:
                                "linear-gradient(135deg, var(--color-gold-dark), var(--color-gold))",
                            }
                          : undefined
                      }
                      aria-hidden
                    >
                      {/* Delivery van — the milestone's reward is shipping */}
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="1" y="5" width="13" height="10" rx="1" />
                        <path d="M14 9h4l3 4v2h-7V9z" />
                        <circle cx="5.5" cy="17.5" r="1.8" />
                        <circle cx="17.5" cy="17.5" r="1.8" />
                      </svg>
                    </div>
                  </div>
                </div>

                <ul className="flex-1 overflow-y-auto divide-y divide-ink/10">
                  {lines.map((line) => (
                    <li key={line.id} className="flex gap-4 px-6 py-5">
                      <Link
                        href={`/products/${line.slug}`}
                        onClick={closeCart}
                        className="relative w-20 h-24 shrink-0 overflow-hidden bg-stone"
                      >
                        {line.image_url && (
                          <Image
                            src={line.image_url}
                            alt={line.name}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        )}
                      </Link>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/products/${line.slug}`}
                              onClick={closeCart}
                              className="block font-display text-base leading-snug hover:text-ink/70 transition-colors line-clamp-2"
                            >
                              {line.name}
                            </Link>
                            {line.metal && (
                              <div className="mt-1 flex items-center gap-1.5">
                                <span
                                  className="w-3 h-3 rounded-full ring-1 ring-ink/15"
                                  style={{ background: metalSwatch[line.metal] }}
                                  aria-hidden
                                />
                                <span className="text-[10px] tracking-[0.18em] uppercase text-ink/55 font-body">
                                  {metalLabels[line.metal]}
                                </span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              trackRemoveFromCart({
                                item_id: line.id,
                                item_name: line.name,
                                item_variant: line.metal ?? undefined,
                                price: line.price,
                                quantity: line.quantity,
                              });
                              removeItem(line.id);
                            }}
                            className="text-ink/40 hover:text-ink transition-colors cursor-pointer shrink-0"
                            aria-label={`Remove ${line.name}${line.metal ? ` (${metalLabels[line.metal]})` : ""}`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="mt-auto pt-3 flex items-center justify-between">
                          <div className="flex items-center border border-ink/15">
                            <button
                              onClick={() => updateQuantity(line.id, line.quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center text-ink/70 hover:text-ink cursor-pointer disabled:opacity-30"
                              disabled={line.quantity <= 1}
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm font-body tabular-nums">
                              {line.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(line.id, line.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center text-ink/70 hover:text-ink cursor-pointer disabled:opacity-30"
                              disabled={line.quantity >= line.maxQuantity}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                          <span className="font-body text-sm text-ink">
                            {formatPrice(line.price * line.quantity)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Frequently bought with — compact upsell strip pinned above
                    the totals, mirroring the classic "make it a set" cart
                    pattern. Suggestions exclude pieces already in the bag. */}
                {suggestions.length > 0 && (
                  <div className="border-t border-ink/10 px-6 pt-4 pb-4">
                    <p className="mb-3 text-[10px] tracking-[0.22em] uppercase text-ink/50 font-body">
                      Frequently bought with
                    </p>
                    <ul className="space-y-2.5">
                      {suggestions.map((p) => (
                        <li key={p.id} className="flex items-center gap-3">
                          <Link
                            href={`/products/${p.slug}`}
                            onClick={closeCart}
                            className="relative h-12 w-10 shrink-0 overflow-hidden bg-stone"
                          >
                            {p.image_url && (
                              <Image
                                src={p.image_url}
                                alt={p.name}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            )}
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/products/${p.slug}`}
                              onClick={closeCart}
                              className="block truncate font-display text-[15px] leading-snug hover:text-ink/70 transition-colors"
                            >
                              {p.name}
                            </Link>
                            <span className="font-body text-xs text-ink/55">
                              {formatPrice(Number(p.price))}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => addSuggestion(p)}
                            aria-label={`Add ${p.name} to bag`}
                            className="shrink-0 border border-ink/20 px-3 py-1.5 text-[10px] tracking-[0.18em] uppercase font-body text-ink/70 hover:bg-ink hover:text-paper hover:border-ink transition-colors cursor-pointer"
                          >
                            + Add
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <footer className="border-t border-ink/10 px-6 py-6 space-y-4 bg-paper-warm">
                  {bundle ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-ink/55">
                        <span>Subtotal</span>
                        <span>{formatPrice(subtotal)}</span>
                      </div>
                      <div
                        className="flex items-center justify-between text-sm"
                        style={{ color: "var(--color-gold-dark)" }}
                      >
                        <span className="flex items-center gap-1.5">
                          <svg
                            className="w-3.5 h-3.5 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                          {bundle.label}
                        </span>
                        <span>−{formatPrice(bundleAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-ink/10">
                        <span className="text-[11px] tracking-[0.2em] uppercase text-ink/55 font-body">
                          Bundle total
                        </span>
                        <span className="font-display text-2xl">
                          {formatPrice(bundleTotal)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stackPerk && (
                        <div
                          className="flex items-center justify-between text-sm"
                          style={{ color: "var(--color-gold-dark)" }}
                        >
                          <span className="flex items-center gap-1.5">
                            <svg
                              className="w-3.5 h-3.5 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 12.75l6 6 9-13.5"
                              />
                            </svg>
                            {stackPerk.label}
                          </span>
                          <span>Free locker shipping</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] tracking-[0.2em] uppercase text-ink/55 font-body">
                          Subtotal
                        </span>
                        <span className="font-display text-2xl">
                          {formatPrice(subtotal)}
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-ink/50">
                    Shipping &amp; taxes calculated at checkout.
                  </p>
                  <Link
                    href="/checkout"
                    onClick={() => {
                      const items = lines.map((l) => ({
                        item_id: l.id,
                        item_name: l.name,
                        item_variant: l.metal ?? undefined,
                        price: l.price,
                        quantity: l.quantity,
                      }));
                      trackBeginCheckout(items, subtotal);
                      fbTrackInitiateCheckout(items, subtotal);
                      closeCart();
                    }}
                    className="block w-full py-4 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors text-center cursor-pointer"
                  >
                    Checkout
                  </Link>
                  <Link
                    href="/shop"
                    onClick={closeCart}
                    className="block text-center text-xs tracking-[0.15em] uppercase text-ink/60 hover:text-ink transition-colors"
                  >
                    Continue Shopping
                  </Link>
                  <PaymentIcons className="pt-1" />
                </footer>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
