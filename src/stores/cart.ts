/**
 * Cart state (Zustand, localStorage-persisted).
 *
 * Architecture:
 * - Lines are stored with a snapshot of product fields (price, name, image,
 *   maxQuantity) so the cart renders without re-hitting the DB. The server
 *   re-prices everything at checkout; the cart fields are display-only.
 * - hasHydrated gates rendering on the first paint so the SSR/CSR mismatch
 *   between an empty server cart and a localStorage-populated client cart
 *   doesn't trigger React's hydration warning.
 * - updatedAt is bumped on every mutation. On rehydration, carts older than
 *   CART_MAX_AGE_MS are dropped so a customer returning months later
 *   doesn't checkout at last quarter's prices.
 *
 * Selectors live at the bottom of the file: selectCartCount, selectCartSubtotal.
 * Prefer those over reading `lines` directly so renders only run when the
 * derived value actually changes.
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartLine, Product } from "@/types";

const CART_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface CartState {
  lines: CartLine[];
  isOpen: boolean;
  hasHydrated: boolean;
  updatedAt: number;
  _setHasHydrated: (v: boolean) => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clear: () => void;
}

const clampQty = (desired: number, max: number) => {
  if (!Number.isFinite(desired)) return 1;
  const n = Math.floor(desired);
  if (n < 1) return 1;
  if (max > 0 && n > max) return max;
  return n;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      hasHydrated: false,
      updatedAt: Date.now(),
      _setHasHydrated: (v) => set({ hasHydrated: v }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),
      addItem: (product, quantity = 1) =>
        set((state) => {
          const max = product.quantity ?? 0;
          if (!product.in_stock || max <= 0) return state;
          const existing = state.lines.find((l) => l.id === product.id);
          if (existing) {
            const next = clampQty(existing.quantity + quantity, max);
            return {
              isOpen: true,
              updatedAt: Date.now(),
              lines: state.lines.map((l) =>
                l.id === product.id ? { ...l, quantity: next } : l,
              ),
            };
          }
          const line: CartLine = {
            id: product.id,
            slug: product.slug,
            name: product.name,
            description: product.description ?? null,
            price: Number(product.price),
            image_url: product.image_url,
            metal: product.metal ?? null,
            quantity: clampQty(quantity, max),
            maxQuantity: max,
          };
          return {
            isOpen: true,
            updatedAt: Date.now(),
            lines: [...state.lines, line],
          };
        }),
      removeItem: (id) =>
        set((state) => ({
          updatedAt: Date.now(),
          lines: state.lines.filter((l) => l.id !== id),
        })),
      updateQuantity: (id, quantity) =>
        set((state) => ({
          updatedAt: Date.now(),
          lines: state.lines
            .map((l) =>
              l.id === id ? { ...l, quantity: clampQty(quantity, l.maxQuantity) } : l,
            )
            .filter((l) => l.quantity > 0),
        })),
      clear: () => set({ lines: [], updatedAt: Date.now() }),
    }),
    {
      name: "charmistry-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines, updatedAt: state.updatedAt }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Drop carts older than CART_MAX_AGE_MS so returning visitors
          // don't checkout with stale prices or quantities.
          const age = Date.now() - (state.updatedAt ?? 0);
          if (age > CART_MAX_AGE_MS) {
            state.lines = [];
            state.updatedAt = Date.now();
          }
          state._setHasHydrated(true);
        }
      },
    },
  ),
);

export const selectCartCount = (s: CartState) =>
  s.lines.reduce((acc, l) => acc + l.quantity, 0);

export const selectCartSubtotal = (s: CartState) =>
  s.lines.reduce((acc, l) => acc + l.price * l.quantity, 0);
