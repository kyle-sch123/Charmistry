import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductDetail from "@/components/product/ProductDetail";
import ProductCard from "@/components/ui/ProductCard";
import {
  getProductBySlug,
  getProductVariants,
  getRelatedProducts,
} from "@/lib/queries";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) return { title: "Product not found | Charmistry" };
  return {
    title: `${product.name} | Charmistry`,
    description:
      product.description?.slice(0, 160) ??
      `${product.name} — ${formatPrice(product.price)}`,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.image_url ? [{ url: product.image_url }] : undefined,
    },
  };
}

export default async function ProductPage(
  { params }: { params: Promise<Params> },
) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [variants, related] = await Promise.all([
    getProductVariants(product.name, product.category_id),
    getRelatedProducts(product.category_id, product.id, 4),
  ]);

  // Exclude siblings from "You may also like" to avoid duplication with the
  // variant selector.
  const variantIds = new Set(variants.map((v) => v.id));
  const filteredRelated = related.filter((r) => !variantIds.has(r.id));

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper text-ink pt-28 pb-24">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <nav className="text-[11px] tracking-[0.15em] uppercase text-ink/55 font-body mb-8 flex items-center gap-2">
            <Link href="/" className="hover:text-ink transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/shop" className="hover:text-ink transition-colors">
              Shop
            </Link>
            {product.categories && (
              <>
                <span>/</span>
                <Link
                  href={`/shop?category=${product.categories.slug}`}
                  className="hover:text-ink transition-colors"
                >
                  {product.categories.name}
                </Link>
              </>
            )}
          </nav>

          <ProductDetail product={product} variants={variants} />

          {filteredRelated.length > 0 && (
            <section className="mt-28 border-t border-ink/10 pt-16">
              <div className="flex items-end justify-between mb-10">
                <div>
                  <p className="text-[11px] tracking-[0.25em] uppercase text-ink/55 font-body mb-2">
                    You may also like
                  </p>
                  <h2 className="font-display text-3xl md:text-4xl font-light">
                    Curated for you
                  </h2>
                </div>
                <Link
                  href="/shop"
                  className="hidden sm:inline text-[11px] tracking-[0.2em] uppercase text-ink/60 hover:text-ink transition-colors"
                >
                  View all
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                {filteredRelated.map((p) => (
                  <ProductCard key={p.id} product={p} variant="light" />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
