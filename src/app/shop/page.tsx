import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/ui/ProductCard";
import { getCategories, getProducts, getProductsByCategory } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Shop | Charmistry",
  description:
    "Browse the full Charmistry collection — rings, necklaces, earrings, bracelets and jewellery boxes.",
};

export const revalidate = 300;

type SearchParams = { category?: string };

export default async function ShopPage(
  { searchParams }: { searchParams: Promise<SearchParams> },
) {
  const { category } = await searchParams;
  const [categories, products] = await Promise.all([
    getCategories(),
    category ? getProductsByCategory(category) : getProducts(),
  ]);

  const activeCategory =
    category && categories.find((c) => c.slug === category);

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper text-ink pt-28 pb-24">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          {/* Header */}
          <header className="mb-14 text-center">
            <p className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body mb-4">
              The Collection
            </p>
            <h1 className="font-heading text-5xl md:text-7xl font-light leading-[0.95]">
              {activeCategory ? activeCategory.name : "Shop"}
            </h1>
            <p className="mt-5 max-w-xl mx-auto text-ink/60">
              {activeCategory
                ? activeCategory.description ??
                  "Pieces made to become a part of you."
                : "Every piece is a quiet declaration. Browse the full collection."}
            </p>
          </header>

          {/* Category filter */}
          <nav className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-14">
            <FilterChip href="/shop" active={!category} label="All" />
            {categories.map((c) => (
              <FilterChip
                key={c.id}
                href={`/shop?category=${c.slug}`}
                active={category === c.slug}
                label={c.name}
                count={c.product_count}
              />
            ))}
          </nav>

          {products.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-display text-2xl mb-3">Nothing here yet</p>
              <p className="text-ink/55 text-sm mb-8">
                This category is being curated. Check back soon.
              </p>
              <Link
                href="/shop"
                className="inline-block px-8 py-3 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors"
              >
                View all
              </Link>
            </div>
          ) : (
            <>
              <p className="text-[11px] tracking-[0.2em] uppercase text-ink/55 font-body mb-6">
                {products.length} {products.length === 1 ? "piece" : "pieces"}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} variant="light" />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-[11px] tracking-[0.2em] uppercase font-body transition-colors border ${
        active
          ? "bg-ink text-paper border-ink"
          : "border-ink/15 text-ink/70 hover:text-ink hover:border-ink/40"
      }`}
    >
      {label}
      {count != null && (
        <span className={`ml-2 ${active ? "text-paper/60" : "text-ink/40"}`}>
          {count}
        </span>
      )}
    </Link>
  );
}
