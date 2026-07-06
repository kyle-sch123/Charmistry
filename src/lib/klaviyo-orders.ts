/**
 * Shared Order → Klaviyo payload mapping.
 *
 * Two server-side surfaces emit order-lifecycle events — the PayFast ITN
 * handler ("Placed Order" / "Ordered Product") and the admin fulfilment
 * endpoint ("Fulfilled Order"). Both embed the customer profile and an Items
 * array built from the same order rows, and Klaviyo email templates reference
 * those property names across the whole lifecycle — so the mapping lives here,
 * once. Event-specific property bags stay at the call sites.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, OrderItem } from "@/types";
import type { KlaviyoCustomer } from "@/lib/klaviyo";

export const KLAVIYO_BRAND = "Charmistry";

export function klaviyoProductUrl(
  slug: string | null | undefined,
): string | undefined {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return slug && base ? `${base}/products/${slug}` : undefined;
}

/** The embedded profile for order events — identity + shipping location. */
export function klaviyoCustomerFor(order: Order): KlaviyoCustomer {
  return {
    email: order.email,
    first_name: order.first_name,
    last_name: order.last_name,
    phone: order.phone,
    address1: order.shipping_address_line1,
    address2: order.shipping_address_line2,
    city: order.shipping_city,
    zip: order.shipping_postal_code,
    country: order.shipping_country,
  };
}

/**
 * Map product_id → category name for a set of line items, in one round-trip.
 * Best-effort: a query failure just returns an empty map and events go out
 * without Categories rather than failing.
 */
export async function fetchCategoryByProduct(
  supabase: SupabaseClient,
  items: OrderItem[],
): Promise<Map<string, string>> {
  const categoryByProduct = new Map<string, string>();
  const productIds = items
    .map((it) => it.product_id)
    .filter((id): id is string => Boolean(id));
  if (productIds.length === 0) return categoryByProduct;

  const { data: products } = await supabase
    .from("products")
    .select("id, categories(name)")
    .in("id", productIds);
  for (const p of products ?? []) {
    const row = p as {
      id: string;
      categories: { name: string } | { name: string }[] | null;
    };
    const cat = Array.isArray(row.categories)
      ? row.categories[0]?.name
      : row.categories?.name;
    if (cat) categoryByProduct.set(row.id, cat);
  }
  return categoryByProduct;
}

export function categoryFor(
  categoryByProduct: Map<string, string>,
  it: OrderItem,
): string | undefined {
  return it.product_id ? categoryByProduct.get(it.product_id) : undefined;
}

/** The Items array both Placed Order and Fulfilled Order carry. */
export function klaviyoLineItemsFor(
  items: OrderItem[],
  categoryByProduct: Map<string, string>,
) {
  return items.map((it) => {
    const cat = categoryFor(categoryByProduct, it);
    return {
      ProductID: it.product_id ?? it.product_slug,
      SKU: it.product_slug,
      ProductName: it.product_name,
      Quantity: it.quantity,
      ItemPrice: Number(it.unit_price),
      RowTotal: Number(it.line_total),
      ProductURL: klaviyoProductUrl(it.product_slug),
      ImageURL: it.product_image_url ?? undefined,
      ProductCategories: cat ? [cat] : [],
      ProductBrand: KLAVIYO_BRAND,
    };
  });
}

/** Distinct category names across the order, for the top-level Categories prop. */
export function klaviyoCategoriesFor(
  items: OrderItem[],
  categoryByProduct: Map<string, string>,
): string[] {
  return Array.from(
    new Set(
      items
        .map((it) => categoryFor(categoryByProduct, it))
        .filter((c): c is string => Boolean(c)),
    ),
  );
}
