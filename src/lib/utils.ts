/** Small utility helpers shared across UI components. */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Rand formatting for every price on the storefront.
 *
 * Catalogue prices are whole rands, so a bare "R159" is the house style — but
 * percentage promos (the stacks) produce real cents, and the default
 * toLocaleString drops trailing zeros, which rendered R474.30 as "R474,3".
 * Cents are therefore all-or-nothing: two digits when there are any, none when
 * the amount is whole.
 */
export function formatPrice(amount: number): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return `R${amount.toLocaleString("en-ZA", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

/**
 * Whether a product's `size` marks it as adjustable length. Mirrors the sentinel
 * ProductDetail's formatSize uses: a stored size of 0 (rings / bracelets that
 * fit any wrist) surfaces as "Adjustable". Centralised here so the shop card and
 * the PDP agree on what counts as adjustable.
 */
export function isAdjustableSize(
  size: string | number | null | undefined,
): boolean {
  if (size === null || size === undefined) return false;
  const raw = String(size).trim();
  return raw === "0" || raw === "0.0";
}
