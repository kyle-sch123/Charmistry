/**
 * GET /api/cart/suggestions?exclude=slug-a,slug-b — up to 3 purchasable
 * pieces for the cart drawer's "Frequently bought with" strip.
 *
 * Best sellers first (review_count, then rating), consolidated to one row per
 * piece (the shop-grid rule) so two metals of the same piece never both
 * appear. `exclude` carries the cart's current slugs; exclusion is by PIECE,
 * not slug, so the gold variant of something already in the bag isn't
 * suggested back in silver. Jewellery boxes are fair game — they pair well
 * with everything.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import { pickPieceRepresentatives, pieceKeyOf } from "@/lib/pieces";
import type { ProductWithCategory } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCT_SELECT =
  "id, name, slug, description, price, category_id, metal, badge, material, size, image_url, images, in_stock, rating, review_count, quantity, created_at, shop_featured, categories(name, slug)";

const LIMIT = 3;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const exclude = new Set(
    (searchParams.get("exclude") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("in_stock", true)
    .gt("quantity", 0)
    .order("review_count", { ascending: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(60);

  if (error) {
    console.error("Cart suggestions API error", error);
    return Response.json({ error: "failed_to_load" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as ProductWithCategory[];
  // Piece keys of everything already in the bag — any variant row whose slug
  // is excluded marks its whole piece as excluded.
  const excludedPieces = new Set(
    rows.filter((r) => exclude.has(r.slug)).map((r) => pieceKeyOf(r)),
  );

  const suggestions = pickPieceRepresentatives(rows)
    .filter((r) => !exclude.has(r.slug) && !excludedPieces.has(pieceKeyOf(r)))
    .slice(0, LIMIT);

  return Response.json({ products: suggestions });
}
