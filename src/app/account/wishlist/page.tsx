/**
 * Wishlist page — server-fetched under RLS (own rows joined to the publicly
 * readable products), rendered by a client grid that mirrors the wishlist
 * store so un-hearting a card removes it instantly without a reload.
 */

import Link from "next/link";
import { createAuthServerClient } from "@/lib/auth/server";
import type { ProductWithCategory } from "@/types";
import WishlistGrid from "./WishlistGrid";

export const dynamic = "force-dynamic";

interface WishlistRow {
  product_id: string;
  created_at: string;
  products: ProductWithCategory | null;
}

export default async function AccountWishlistPage() {
  const supabase = await createAuthServerClient();

  const { data } = await supabase
    .from("wishlist_items")
    .select("product_id, created_at, products(*, categories(name, slug))")
    .order("created_at", { ascending: false })
    .returns<WishlistRow[]>();

  // A null join means the product has been removed from the catalogue; the
  // wishlist row itself is gone too (FK cascade), so just filter defensively.
  const products = (data ?? [])
    .map((row) => row.products)
    .filter((p): p is ProductWithCategory => p !== null);

  if (products.length === 0) {
    return (
      <div className="border border-ink/10 p-8 text-center">
        <p className="text-sm text-ink/60 leading-relaxed mb-6">
          Nothing saved yet. Tap the heart on any piece to keep it here for
          later.
        </p>
        <Link
          href="/shop"
          className="inline-block px-8 py-3 bg-ink text-paper text-[11px] tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors"
        >
          Browse the Collection
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body">
        Saved Pieces
      </h2>
      <WishlistGrid products={products} />
    </div>
  );
}
