"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCart, selectCartSubtotal } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";
import type { MetalType } from "@/types";

const metalLabels: Record<MetalType, string> = {
  gold: "Gold",
  silver: "Silver",
  rose_gold: "Rose Gold",
  white_gold: "White Gold",
  platinum: "Platinum",
};

const metalSwatch: Record<MetalType, string> = {
  gold: "linear-gradient(135deg, #F5E6C8 0%, #C9A84C 55%, #9A7B2F 100%)",
  silver: "linear-gradient(135deg, #F5F5F5 0%, #C8C8C8 55%, #8A8A8E 100%)",
  rose_gold: "linear-gradient(135deg, #FFD7CC 0%, #E0A899 55%, #B4735F 100%)",
  white_gold: "linear-gradient(135deg, #FAFAFA 0%, #E4E4E4 55%, #B4B4B4 100%)",
  platinum: "linear-gradient(135deg, #F0F0F0 0%, #D2D2D2 55%, #9A9A9A 100%)",
};

export default function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const lines = useCart((s) => s.lines);
  const subtotal = useCart(selectCartSubtotal);
  const closeCart = useCart((s) => s.closeCart);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const removeItem = useCart((s) => s.removeItem);

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
                            onClick={() => removeItem(line.id)}
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

                <footer className="border-t border-ink/10 px-6 py-6 space-y-4 bg-paper-warm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] tracking-[0.2em] uppercase text-ink/55 font-body">
                      Subtotal
                    </span>
                    <span className="font-display text-2xl">{formatPrice(subtotal)}</span>
                  </div>
                  <p className="text-xs text-ink/50">
                    Shipping &amp; taxes calculated at checkout.
                  </p>
                  <Link
                    href="/checkout"
                    onClick={closeCart}
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
                </footer>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
