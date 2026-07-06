/** Small utility helpers shared across UI components. */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return `R${amount.toLocaleString("en-ZA")}`;
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
