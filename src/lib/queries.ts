/**
 * Catalogue reads via the anon Supabase client.
 *
 * This file is the public read surface — everything here is callable from
 * Server Components or directly from the browser via the same anon key.
 * Writes never go through this module; see /api/* routes for those.
 *
 * Two non-obvious behaviours worth knowing about:
 * - getShopProducts() de-duplicates by (name + category_id). The DB stores
 *   one row per metal variant; the shop grid shows one tile per piece, and
 *   the variant picker on the PDP surfaces the metals.
 * - getProductImages() lists a Supabase Storage bucket by prefix-matching
 *   the product slug. If the bucket isn't list-able by the anon role the
 *   call returns []; the PDP falls back to the row's image_url + images[].
 */

import { supabase } from "./supabase";
import type {
  MetalType,
  ProductWithCategory,
  CategoryWithCount,
} from "@/types";

const PRODUCT_SELECT = "*, categories(name, slug)";

export async function getProducts(): Promise<ProductWithCategory[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .order("name");

  if (error) throw error;
  return data as ProductWithCategory[];
}

export async function getProductsByCategory(
  categorySlug: string,
): Promise<ProductWithCategory[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, categories!inner(name, slug)")
    .eq("categories.slug", categorySlug)
    .order("name");

  if (error) throw error;
  return data as ProductWithCategory[];
}

export type ShopSort =
  | "best-selling"
  | "price-asc"
  | "price-desc"
  | "newest"
  | "name-asc";

export interface ShopQuery {
  categorySlug?: string;
  sort?: ShopSort;
  inStockOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  metals?: MetalType[];
}

/**
 * Single entry point for the /shop page. Applies category, availability and
 * price filters then sorts server-side via Supabase so pagination/total count
 * stay correct.
 */
export async function getShopProducts(
  opts: ShopQuery = {},
): Promise<ProductWithCategory[]> {
  const {
    categorySlug,
    sort = "best-selling",
    inStockOnly,
    minPrice,
    maxPrice,
    metals,
  } = opts;

  // categories!inner is required only when filtering by slug; otherwise leave
  // the join optional so products without a category still come through.
  const select = categorySlug
    ? "*, categories!inner(name, slug)"
    : PRODUCT_SELECT;

  let query = supabase.from("products").select(select);

  if (categorySlug) query = query.eq("categories.slug", categorySlug);
  if (inStockOnly) query = query.eq("in_stock", true);
  if (typeof minPrice === "number") query = query.gte("price", minPrice);
  if (typeof maxPrice === "number") query = query.lte("price", maxPrice);
  if (metals && metals.length > 0) query = query.in("metal", metals);

  switch (sort) {
    case "price-asc":
      query = query.order("price", { ascending: true });
      break;
    case "price-desc":
      query = query.order("price", { ascending: false });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "name-asc":
      query = query.order("name", { ascending: true });
      break;
    case "best-selling":
    default:
      query = query
        .order("review_count", { ascending: false })
        .order("rating", { ascending: false, nullsFirst: false });
      break;
  }

  const { data, error } = await query;
  if (error) throw error;

  const uniqueProducts: ProductWithCategory[] = [];
  const seenKeys = new Set<string>();

  for (const product of (data ?? []) as ProductWithCategory[]) {
    const key = `${product.name.trim().toLowerCase()}|${product.category_id ?? ""}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    uniqueProducts.push(product);
  }

  return uniqueProducts;
}

/** Min/max price across the catalogue — used to seed the price filter UI. */
export async function getPriceBounds(): Promise<{ min: number; max: number }> {
  const { data, error } = await supabase
    .from("products")
    .select("price")
    .order("price", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return { min: 0, max: 0 };
  const prices = data.map((r) => Number(r.price));
  return {
    min: Math.floor(prices[0]),
    max: Math.ceil(prices[prices.length - 1]),
  };
}

export async function getInStockProducts(): Promise<ProductWithCategory[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("in_stock", true)
    .order("name");

  if (error) throw error;
  return data as ProductWithCategory[];
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductWithCategory | null> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return (data as ProductWithCategory | null) ?? null;
}

export async function getAllProductSlugs(): Promise<string[]> {
  const { data, error } = await supabase.from("products").select("slug");
  if (error) throw error;
  return (data ?? []).map((r) => r.slug as string);
}

/**
 * Fetch every product sharing the same (trimmed) name + category — i.e. the
 * metal variants of the same piece. The current product is included so the
 * caller can key off it.
 */
export async function getProductVariants(
  name: string,
  categoryId: string | null,
): Promise<ProductWithCategory[]> {
  if (!categoryId) return [];
  const trimmed = name.trim();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .ilike("name", trimmed)
    .eq("category_id", categoryId)
    .order("metal", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data as ProductWithCategory[];
}

export async function getRelatedProducts(
  categoryId: string | null,
  excludeId: string,
  limit = 4,
): Promise<ProductWithCategory[]> {
  if (!categoryId) return [];
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("category_id", categoryId)
    .neq("id", excludeId)
    .eq("in_stock", true)
    .limit(limit);

  if (error) throw error;
  return data as ProductWithCategory[];
}

export async function searchProducts(
  term: string,
  limit = 8,
): Promise<ProductWithCategory[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];
  // Escape % and _ so user input is treated as literal characters.
  const escaped = trimmed.replace(/[%_\\]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .or(`name.ilike.${pattern},description.ilike.${pattern}`)
    .limit(limit);

  if (error) throw error;
  return data as ProductWithCategory[];
}

export async function getCategories(): Promise<CategoryWithCount[]> {
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (catError) throw catError;

  const { data: counts, error: countError } = await supabase
    .from("products")
    .select("category_id");

  if (countError) throw countError;

  const countMap = new Map<string, number>();
  for (const row of counts) {
    if (row.category_id) {
      countMap.set(row.category_id, (countMap.get(row.category_id) || 0) + 1);
    }
  }

  return categories.map((cat) => ({
    ...cat,
    product_count: countMap.get(cat.id) || 0,
  })) as CategoryWithCount[];
}

export async function getProductImages(productName: string): Promise<string[]> {
  const bucketName = process.env.S3_BUCKET_NAME ?? "Charmistry Assets";

  const { data, error } = await supabase.storage
    .from(bucketName)
    .list("", { limit: 100 });

  if (error) {
    console.warn("getProductImages: bucket list failed", error);
    return [];
  }
  if (!data) return [];

  // Match the slug as a word-boundary prefix (e.g. "ring" matches "ring-gold.jpg"
  // but not "ring-set-silver.jpg"). Avoids unrelated products bleeding in.
  const slug = productName.toLowerCase().replace(/\s+/g, "-");
  const slugPattern = new RegExp(`(^|[/_-])${escapeRegex(slug)}([_.-]|$)`, "i");

  const matched = data
    .filter((file) => slugPattern.test(file.name))
    .map((file) => {
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(file.name);
      return urlData.publicUrl;
    });

  return matched;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
