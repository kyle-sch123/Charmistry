/**
 * Shared server helpers for the /admin/catalogue tool — slug generation, the
 * piece grouping key, image URL/path plumbing, and enum constants. Imported by
 * the admin product + image API routes. Server-only (pulls in BUCKET_NAME and
 * touches the service-role Supabase client).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BadgeType, MetalType } from "@/types";
import { BUCKET_NAME } from "./storage";

export const METALS: readonly MetalType[] = [
  "gold",
  "silver",
  "rose_gold",
  "white_gold",
  "platinum",
];

export const BADGES: readonly BadgeType[] = ["NEW", "BESTSELLER", "LIMITED"];

/** URL-safe slug from a product/piece name. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** True for a full http(s) URL (as opposed to a legacy bare filename). */
export function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Grouping key for variant rows → "pieces". Matches the shop grid's de-dupe
 * key in queries.ts so the admin's notion of a piece equals the storefront's.
 */
export function pieceKey(name: string, categoryId: string | null): string {
  return `${name.trim().toLowerCase()}|${categoryId ?? ""}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Public URLs of bucket-root files whose name matches the piece slug — the
 * same word-boundary prefix match getProductImages() uses on the storefront.
 * Used only as a fallback for legacy pieces that have no managed images[] yet,
 * so the owner can see (and adopt) existing photos.
 */
export function discoverBucketImages(
  supabase: SupabaseClient,
  files: { name: string }[],
  productName: string,
): string[] {
  const slug = productName.toLowerCase().replace(/\s+/g, "-");
  const pattern = new RegExp(`(^|[/_-])${escapeRegex(slug)}([_.-]|$)`, "i");
  return files
    .filter((f) => pattern.test(f.name))
    .map(
      (f) =>
        supabase.storage.from(BUCKET_NAME).getPublicUrl(f.name).data.publicUrl,
    );
}

/**
 * The photo (products.image_url) a row should keep after its gallery changes.
 * image_url is what the cart, search and OG tags show for this variant — and,
 * on the row flagged `shop_featured`, what the shop grid shows for the whole
 * piece. So a deliberate choice must survive reorders, uploads and unrelated
 * deletes, falling back only when the chosen photo itself leaves the gallery.
 *
 * `row` is the DB state BEFORE the change; `nextImages` the gallery being
 * written. Two ways a choice is recognised:
 *   - shop_featured — the owner ticked this exact photo as the shop image, so
 *     it is honoured wherever it sits, including position 0.
 *   - it differs from the old primary — the older heuristic, still the signal
 *     for non-featured rows whose photo was pinned before the flag existed.
 * Otherwise image_url simply shadows the new primary.
 */
export function nextThumbnail(
  row: {
    images: string[] | null;
    image_url: string | null;
    shop_featured?: boolean | null;
  },
  nextImages: string[],
): string | null {
  const current = row.image_url;
  if (current && nextImages.includes(current)) {
    if (row.shop_featured) return current;
    const oldPrimary = (row.images ?? []).filter(isAbsoluteUrl)[0] ?? null;
    if (current !== oldPrimary) return current;
  }
  return nextImages[0] ?? null;
}

/**
 * Given a Supabase public URL that points into our bucket, return the object
 * path storage.remove() needs, or null if the URL isn't in our bucket. Public
 * URLs look like `.../storage/v1/object/public/<bucket>/<path>`. The bucket
 * name may contain spaces (URL-encoded), so we decode before matching.
 */
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = "/storage/v1/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  const prefix = `${BUCKET_NAME}/`;
  if (!rest.startsWith(prefix)) return null;
  return rest.slice(prefix.length);
}
