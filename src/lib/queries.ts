import { supabase } from "./supabase";
import type { ProductWithCategory, CategoryWithCount } from "@/types";

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
  categorySlug: string
): Promise<ProductWithCategory[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, categories!inner(name, slug)")
    .eq("categories.slug", categorySlug)
    .order("name");

  if (error) throw error;
  return data as ProductWithCategory[];
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

export async function getFeaturedProducts(
  limit = 8
): Promise<ProductWithCategory[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("in_stock", true)
    .order("review_count", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as ProductWithCategory[];
}

export async function getBestsellers(
  limit = 5
): Promise<ProductWithCategory[]> {
  // True bestsellers: most-reviewed in-stock pieces, tie-broken by rating.
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("in_stock", true)
    .order("review_count", { ascending: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw error;
  return data as ProductWithCategory[];
}

export async function getProductBySlug(
  slug: string
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

export async function getRelatedProducts(
  categoryId: string | null,
  excludeId: string,
  limit = 4
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
  limit = 8
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
