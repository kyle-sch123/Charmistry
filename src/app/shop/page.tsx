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

