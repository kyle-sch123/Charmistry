/**
 * GET /api/bestsellers — top 5 in-stock products by review_count then rating.
 * Used by the home-page BestSellers section so it can render after the
 * cart hydrates without blocking the shell. Cacheable.
 */

import { createServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCT_SELECT =
  "id, name, slug, description, price, category_id, metal, badge, material, size, image_url, images, in_stock, rating, review_count, quantity, created_at, categories(name, slug)";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("in_stock", true)
    .order("review_count", { ascending: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(5);

  if (error) {
    console.error("Bestsellers API error", error);
    return new Response(JSON.stringify({ error: "failed_to_load" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ products: data ?? [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
