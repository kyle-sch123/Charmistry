/**
 * Best Sellers — a dedicated, curated page of the catalogue's most-loved
 * pieces (ranked by review_count, tie-broken by rating; in-stock only).
 *
 * Deliberately its OWN page rather than a /shop?sort=best-selling redirect: it
 * has its own header and copy, drops the filter bar, caps to a highlight set,
 * and offers a path through to the full collection. Server-rendered like /shop
 * so the grid streams in the initial HTML.
 */

import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/ui/ProductCard";
import { getShopProducts } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Best Sellers | Charmistry",
  description:
    "Charmistry's most-loved pieces — our best-selling rings, necklaces, earrings, bracelets and jewellery boxes.",
};

export const dynamic = "force-dynamic";

// Curated highlight set — keep it a shortlist, not the whole catalogue.
const MAX_BEST_SELLERS = 12;

export default async function BestSellersPage() {
  const products = (
    await getShopProducts({ sort: "best-selling", inStockOnly: true })
  ).slice(0, MAX_BEST_SELLERS);

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
                  Customer Favourites
                </p>
                <h1
                  className="text-ink uppercase leading-[0.92]"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "clamp(3rem, 7vw, 6rem)",
                    letterSpacing: "0.02em",
                  }}
                >
                  Best Sellers
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
                The pieces our community reaches for again and again — ranked by
                what&apos;s loved most.
              </p>
            </div>
          </header>

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
                Bestsellers are on their way
              </p>
              <p
                className="text-ink/50"
                style={{ fontFamily: "var(--font-body)", fontSize: "13px" }}
              >
                In the meantime, explore the full collection.
              </p>
              <Link
                href="/shop"
                className="mt-2 inline-block px-8 py-3 bg-ink text-paper text-[10px] tracking-[0.25em] uppercase font-body hover:opacity-80 transition-opacity cursor-pointer"
              >
                Browse the collection
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10 md:gap-x-7 md:gap-y-14">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} variant="light" />
                ))}
              </div>

              {/* Path through to the full catalogue */}
              <div className="mt-16 flex justify-center">
                <Link
                  href="/shop"
                  className="group inline-flex items-center gap-2.5 border border-ink text-ink px-8 py-3.5 text-[10px] tracking-[0.25em] uppercase font-body hover:bg-ink hover:text-paper transition-colors cursor-pointer"
                >
                  Explore All Pieces
                  <svg
                    className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
