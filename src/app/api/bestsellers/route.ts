/**
 * GET /api/bestsellers — top 5 in-stock PIECES by review_count then rating.
 * Used by the home-page BestSellers section so it can render after the
 * cart hydrates without blocking the shell. Cacheable.
 *
 * Consolidated to one row per piece (the shop-grid rule, shared with /shop and
 * /api/cart/suggestions) so the gold and silver rows of one necklace can't take
 * two of the five tiles between them. Reviews are aggregated across a piece's
 * variants, so every variant carries the SAME review_count — which means as
 * soon as a well-reviewed piece exists, its metals sort adjacently and fill the
 * grid with duplicates. Hence the over-fetch below and the slice afterwards:
 * ranking has to happen on variant rows, but the cut to five happens on pieces.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import { pickPieceRepresentatives } from "@/lib/pieces";
import type { ProductWithCategory } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// shop_featured is what lets pickPieceRepresentatives honour the owner's chosen
// photo for a piece rather than whichever metal happened to sort first.
const PRODUCT_SELECT =
  "id, name, slug, description, price, category_id, metal, badge, material, size, image_url, images, in_stock, rating, review_count, quantity, created_at, shop_featured, categories(name, slug)";

const LIMIT = 5;

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    // Hidden pieces stay out of every browse surface (migration 011).
    .eq("shop_hidden", false)
    .eq("in_stock", true)
    .order("review_count", { ascending: false })
    .order("rating", { ascending: false, nullsFirst: false })
    // Over-fetch variant rows so there are still five distinct pieces left
    // after consolidation; mirrors /api/cart/suggestions.
    .limit(60);

  if (error) {
    console.error("Bestsellers API error", error);
    return new Response(JSON.stringify({ error: "failed_to_load" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const products = pickPieceRepresentatives(
    (data ?? []) as unknown as ProductWithCategory[],
  ).slice(0, LIMIT);

  return new Response(JSON.stringify({ products }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
