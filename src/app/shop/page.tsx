/**
 * Shop grid — server-renders the catalogue with category, availability,
 * price and metal filters applied. Filters and sort live in the URL query
 * string, so links are shareable and the back button works.
 *
 * URL params:
 *   category   — slug (rings, necklaces, …); whitelisted server-side.
 *   sort       — best-selling | price-asc | price-desc | newest | name-asc.
 *   in_stock   — "1" to filter to in-stock only.
 *   min_price  — numeric, ZAR.
 *   max_price  — numeric, ZAR.
 *   metals     — comma-separated MetalType; values not in ALLOWED_METALS
 *                are silently dropped (no error UI for typos).
 */

import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/ui/ProductCard";
import ShopFilterBar from "@/components/shop/ShopFilterBar";
import {
  getCategories,
  getPriceBounds,
  getShopProducts,
  type ShopSort,
} from "@/lib/queries";
import { RINGS_STACK } from "@/lib/bundles";
import type { MetalType } from "@/types";

export const metadata: Metadata = {
  title: "Shop | Charmistry",
  description:
    "Browse the full Charmistry collection — rings, necklaces, earrings, bracelets and jewellery boxes.",
};

export const dynamic = "force-dynamic";

type SearchParams = {
  category?: string;
  sort?: string;
  in_stock?: string;
  min_price?: string;
  max_price?: string;
  metals?: string;
};

const ALLOWED_SORTS: ShopSort[] = [
  "best-selling",
  "price-asc",
  "price-desc",
  "newest",
  "name-asc",
];

const ALLOWED_METALS: MetalType[] = [
  "gold",
  "silver",
  "rose_gold",
  "white_gold",
  "platinum",
];

const parseMetals = (v: string | undefined): MetalType[] => {
  if (!v) return [];
  const set = new Set<MetalType>();
  for (const raw of v.split(",")) {
    const candidate = raw.trim() as MetalType;
    if (ALLOWED_METALS.includes(candidate)) set.add(candidate);
  }
  return [...set];
};

const parsePrice = (v: string | undefined): number | undefined => {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const category = params.category || undefined;
  const sort = (ALLOWED_SORTS as string[]).includes(params.sort ?? "")
    ? (params.sort as ShopSort)
    : "best-selling";
  const inStockOnly = params.in_stock === "1";
  const minPrice = parsePrice(params.min_price);
  const maxPrice = parsePrice(params.max_price);
  const metals = parseMetals(params.metals);

  const [categories, products, priceBounds] = await Promise.all([
    getCategories(),
    getShopProducts({
      categorySlug: category,
      sort,
      inStockOnly,
      minPrice,
      maxPrice,
      metals: metals.length > 0 ? metals : undefined,
    }),
    getPriceBounds(),
  ]);

  const activeCategory = category && categories.find((c) => c.slug === category);

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper text-ink">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pt-32 pb-24">
          {/* ── Header ── */}
          <header>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-8 border-b border-ink/10">
              <div>
                <p
                  className="text-ink/40 uppercase mb-3"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "10px",
                    letterSpacing: "0.35em",
                  }}
                >
                  The Collection
                </p>
                <h1
                  className="text-ink uppercase leading-[0.92]"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "clamp(3rem, 7vw, 6rem)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {activeCategory ? activeCategory.name : "All Pieces"}
                </h1>
              </div>

              <p
                className="text-ink/50 max-w-xs lg:text-right pb-1"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  lineHeight: 1.7,
                }}
              >
                {activeCategory
                  ? (activeCategory.description ?? "Pieces made to become a part of you.")
                  : "Every piece is a quiet declaration.\nBrowse the full collection."}
              </p>
            </div>
          </header>

          {/* ── Filter + Sort bar ── */}
          <Suspense fallback={<div className="py-5 border-y border-ink/10" />}>
            <ShopFilterBar total={products.length} priceBounds={priceBounds} />
          </Suspense>

          {/* ── Stack & Save promo — rings only. Copy is driven off the same
              RINGS_STACK config the checkout charges, so the two can't drift. ── */}
          {category === RINGS_STACK.category && (
            <div className="mt-6 flex items-center justify-center gap-3 border border-gold/40 bg-gold-muted px-5 py-3.5 text-center">
              <svg
                className="w-4 h-4 shrink-0 text-gold-dark"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 01-2-2V9a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
              <p
                className="text-ink"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  letterSpacing: "0.06em",
                  lineHeight: 1.6,
                }}
              >
                <span className="uppercase tracking-[0.2em] text-gold-dark">
                  Stack &amp; Save
                </span>
                {" — "}Add any {RINGS_STACK.minQuantity} rings to your bag and get{" "}
                <span className="text-ink font-medium">
                  {RINGS_STACK.percentOff}% off
                </span>
                , applied automatically at checkout.
              </p>
            </div>
          )}

          {/* ── Products ── */}
          {products.length === 0 ? (
            <div className="mt-8 py-28 flex flex-col items-center gap-5">
              <p
                className="text-ink/30 uppercase"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.3em",
                }}
              >
                No pieces match your filters
              </p>
              <p
                className="text-ink/50"
                style={{ fontFamily: "var(--font-body)", fontSize: "13px" }}
              >
                Try loosening the filters or clearing them.
              </p>
              <Link
                href="/shop"
                className="mt-2 inline-block px-8 py-3 bg-ink text-paper text-[10px] tracking-[0.25em] uppercase font-body hover:opacity-80 transition-opacity cursor-pointer"
              >
                Clear all
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10 md:gap-x-7 md:gap-y-14">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} variant="light" />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

