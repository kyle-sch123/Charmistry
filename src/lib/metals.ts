/**
 * Metal display constants — one place for the customer-facing label and the
 * swatch gradient of each metal variant. Previously duplicated in
 * ProductDetail and CartDrawer (and near-duplicated in ShopFilterBar); any
 * new surface that shows a metal should import from here.
 */

import type { MetalType } from "@/types";

export const metalLabels: Record<MetalType, string> = {
  gold: "Gold",
  silver: "Silver",
  rose_gold: "Rose Gold",
  white_gold: "White Gold",
  platinum: "Platinum",
};

export const metalSwatch: Record<MetalType, string> = {
  gold: "linear-gradient(135deg, #F5E6C8 0%, #C9A84C 55%, #9A7B2F 100%)",
  silver: "linear-gradient(135deg, #F5F5F5 0%, #C8C8C8 55%, #8A8A8E 100%)",
  rose_gold: "linear-gradient(135deg, #FFD7CC 0%, #E0A899 55%, #B4735F 100%)",
  white_gold: "linear-gradient(135deg, #FAFAFA 0%, #E4E4E4 55%, #B4B4B4 100%)",
  platinum: "linear-gradient(135deg, #F0F0F0 0%, #D2D2D2 55%, #9A9A9A 100%)",
};
