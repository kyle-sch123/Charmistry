/**
 * Client grid for the wishlist page. The server provides the full product
 * rows; the store (already the source of truth for every heart) drives
 * instant removal — un-heart a card and it leaves the grid without a
 * round-trip. Until the store finishes loading we show the server list
 * as-is, which matches what the store will contain.
 */

"use client";

import { useEffect } from "react";
import ProductCard from "@/components/ui/ProductCard";
import { useWishlist } from "@/stores/wishlist";
import type { ProductWithCategory } from "@/types";

export default function WishlistGrid({
  products,
}: {
  products: ProductWithCategory[];
}) {
  const ids = useWishlist((s) => s.ids);
  const status = useWishlist((s) => s.status);

  useEffect(() => {
    void useWishlist.getState().load();
  }, []);

  const visible =
    status === "ready" ? products.filter((p) => ids.has(p.id)) : products;

  if (visible.length === 0) {
    return (
      <p className="border border-ink/10 p-8 text-center text-sm text-ink/60">
        Nothing saved any more — hearts you tap will appear here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8">
      {visible.map((product) => (
        <ProductCard key={product.id} product={product} variant="light" />
      ))}
    </div>
  );
}
