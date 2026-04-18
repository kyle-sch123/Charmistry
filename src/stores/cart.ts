"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartLine, Product } from "@/types";

interface CartState {
  lines: CartLine[];
  isOpen: boolean;
  hasHydrated: boolean;
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
          return { isOpen: true, lines: [...state.lines, line] };
        }),
      removeItem: (id) =>
        set((state) => ({ lines: state.lines.filter((l) => l.id !== id) })),
      updateQuantity: (id, quantity) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              l.id === id ? { ...l, quantity: clampQty(quantity, l.maxQuantity) } : l,
            )
            .filter((l) => l.quantity > 0),
        })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "charmistry-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true);
      },
    },
  ),
);

export const selectCartCount = (s: CartState) =>
  s.lines.reduce((acc, l) => acc + l.quantity, 0);

export const selectCartSubtotal = (s: CartState) =>
  s.lines.reduce((acc, l) => acc + l.price * l.quantity, 0);
