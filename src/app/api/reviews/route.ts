/**
 * Reviews endpoint — signed-in writes + public list.
 *
 * Any signed-in account may review any piece; there is deliberately NO
 * purchase gate. It used to require a PAID order containing the piece, which
 * left genuine customers unable to review (guest checkouts, gifts, orders
 * placed on another account) and kept the review count near zero.
 *
 * Sign-in is still required, and it is what keeps the endpoint honest: the
 * identity comes from the verified session cookie (getVerifiedUser), never
 * from the request body, and the one-review-per-piece rule below is keyed to
 * it. Dropping that too would make this an unauthenticated write endpoint with
 * no rate limiting.
 *
 * Why a route (and not a direct browser RLS write like the wishlist): two
 * things must happen server-side with the service role, and neither can be
 * trusted to the client —
 *   1. Aggregate cache: products.rating / products.review_count are recomputed
 *      across every metal variant of the piece so the PDP header and shop cards
 *      stay accurate.
 *   2. One review per user per piece: the piece spans multiple product rows, so
 *      the upsert has to look across variant ids, not a single (user, product).
 *
 * author_name is snapshotted from the profile as a "First L." string so the
 * public read path never touches profiles.
 *
 * Reviews are scoped to the logical piece: rows sharing (name, category_id).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getVerifiedUser } from "@/lib/auth/server";
import { ensureProfileAndClaimOrders } from "@/lib/account";
import { createServerSupabase } from "@/lib/supabase-server";
import { trackKlaviyoEvent, isKlaviyoConfigured } from "@/lib/klaviyo";
import { KLAVIYO_BRAND, klaviyoProductUrl } from "@/lib/klaviyo-orders";
import {
  computeRatingSummary,
  formatAuthorName,
  validateReviewInput,
} from "@/lib/reviews";
import type { Product, Profile, Review } from "@/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SupabaseServer = ReturnType<typeof createServerSupabase>;

/** The product fields the POST path needs — piece resolution + Klaviyo payload. */
type ReviewProduct = Pick<
  Product,
  "id" | "name" | "category_id" | "slug" | "image_url"
> & { categories?: { name: string } | { name: string }[] | null };

/**
 * Emit the "Submitted Review" Klaviyo event so the review-reward flow (coupon
 * email) can trigger. Fired server-side ONLY after the review is persisted, and
 * only for a brand-new review — editing an existing one must not re-send the
 * coupon. Identity comes from the verified session, never the request body.
 * Best-effort: never throws into the response path; $event_id (the review id)
 * lets Klaviyo dedupe any retry.
 */
async function trackReviewSubmitted(
  email: string,
  profile: Pick<Profile, "first_name" | "last_name"> | null,
  product: ReviewProduct,
  review: Review,
): Promise<void> {
  const categoryName = Array.isArray(product.categories)
    ? product.categories[0]?.name
    : product.categories?.name;

  await trackKlaviyoEvent(
    "Submitted Review",
    {
      email,
      first_name: profile?.first_name,
      last_name: profile?.last_name,
    },
    {
      $event_id: review.id,
      ProductID: product.id,
      ProductName: product.name,
      SKU: product.slug,
      ProductURL: klaviyoProductUrl(product.slug),
      ImageURL: product.image_url ?? undefined,
      ProductCategories: categoryName ? [categoryName] : [],
      ProductBrand: KLAVIYO_BRAND,
      Rating: review.rating,
      ReviewTitle: review.title ?? undefined,
      ReviewBody: review.body,
    },
    Math.floor(new Date(review.created_at).getTime() / 1000),
  );
}

/** All product rows making up the piece the given product belongs to. */
async function getPieceProductIds(
  supabase: SupabaseServer,
  product: Pick<Product, "name" | "category_id">,
): Promise<string[]> {
  const trimmed = product.name.trim();
  let query = supabase.from("products").select("id").ilike("name", trimmed);
  query = product.category_id
    ? query.eq("category_id", product.category_id)
    : query.is("category_id", null);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

/**
 * Recompute the piece's rating/review_count from its reviews and write the
 * cache onto every variant row. Best-effort: a failure here doesn't undo an
 * already-saved review (the reviews table stays the source of truth).
 */
async function refreshPieceAggregate(
  supabase: SupabaseServer,
  productIds: string[],
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("reviews")
    .select("rating")
    .in("product_id", productIds)
    .returns<Pick<Review, "rating">[]>();
  if (error) {
    console.error("reviews: aggregate read failed", error);
    return;
  }

  const summary = computeRatingSummary(rows ?? []);
  const { error: updateError } = await supabase
    .from("products")
    .update({
      rating: summary.count > 0 ? summary.average : null,
      review_count: summary.count,
    })
    .in("id", productIds);
  if (updateError) {
    console.error("reviews: aggregate write failed", updateError);
  }
}

export async function POST(request: Request) {
  const user = await getVerifiedUser();
  if (!user) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }

  // --- Parse + validate -----------------------------------------------------
  let productId: string;
  let input: ReturnType<typeof validateReviewInput>;
  try {
    const body = await request.json();
    productId = typeof body?.productId === "string" ? body.productId : "";
    if (!UUID_RE.test(productId)) throw new Error("bad productId");
    input = validateReviewInput(body ?? {});
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!input.ok) {
    return Response.json({ error: input.error }, { status: 400 });
  }

  const supabase = createServerSupabase();

  // --- Resolve the piece ----------------------------------------------------
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, slug, image_url, category_id, categories(name)")
    .eq("id", productId)
    .maybeSingle<ReviewProduct>();
  if (productError) {
    console.error("reviews: product lookup failed", productError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }
  if (!product) {
    return Response.json({ error: "product_not_found" }, { status: 404 });
  }

  let pieceIds: string[];
  try {
    pieceIds = await getPieceProductIds(supabase, product);
  } catch (err) {
    console.error("reviews: piece lookup failed", err);
    return Response.json({ error: "service_error" }, { status: 500 });
  }
  if (pieceIds.length === 0) pieceIds = [product.id];

  // --- Make sure a profile exists -------------------------------------------
  // The author name below is snapshotted from the profile row, and a reviewer
  // arriving straight from the client-side email-OTP sign-in
  // (next=/products/…) has never passed through the auth routes or the
  // /account layout that normally create it. This is the same idempotent,
  // never-throwing helper those paths use; it also opportunistically attaches
  // any guest orders matching the verified email, which is harmless here and
  // useful for the shopper's order history.
  await ensureProfileAndClaimOrders(user);

  // --- Author name snapshot -------------------------------------------------
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle<Pick<Profile, "first_name" | "last_name">>();
  const authorName = formatAuthorName(
    profile?.first_name,
    profile?.last_name,
  );

  // --- Upsert one review per user per piece ---------------------------------
  const { data: existing, error: existingError } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .in("product_id", pieceIds)
    .maybeSingle<Pick<Review, "id">>();
  if (existingError) {
    console.error("reviews: existing lookup failed", existingError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  const values = {
    rating: input.value.rating,
    title: input.value.title,
    body: input.value.body,
    author_name: authorName,
  };

  let saved: Review | null = null;
  if (existing) {
    const { data, error } = await supabase
      .from("reviews")
      .update(values)
      .eq("id", existing.id)
      .select("*")
      .single<Review>();
    if (error) {
      console.error("reviews: update failed", error);
      return Response.json({ error: "service_error" }, { status: 500 });
    }
    saved = data;
  } else {
    const { data, error } = await supabase
      .from("reviews")
      .insert({ product_id: product.id, user_id: user.id, ...values })
      .select("*")
      .single<Review>();
    if (error) {
      console.error("reviews: insert failed", error);
      return Response.json({ error: "service_error" }, { status: 500 });
    }
    saved = data;
  }

  await refreshPieceAggregate(supabase, pieceIds);

  // Reward the review via Klaviyo — but only for a NEW review (edits and
  // reviews of a second variant of an already-reviewed piece take the update
  // path and must not re-trigger the coupon). Best-effort: a Klaviyo failure
  // never fails the already-saved review.
  if (!existing && saved && user.email && isKlaviyoConfigured()) {
    try {
      await trackReviewSubmitted(user.email, profile ?? null, product, saved);
    } catch (err) {
      console.error("reviews: Klaviyo 'Submitted Review' event failed", err);
    }
  }

  return Response.json({ review: saved }, { status: existing ? 200 : 201 });
}

/**
 * GET /api/reviews?productId=<uuid> — public list + summary for a piece.
 * Used to refresh the list after a submit without a full page reload.
 */
export async function GET(request: Request) {
  const productId = new URL(request.url).searchParams.get("productId") ?? "";
  if (!UUID_RE.test(productId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, category_id")
    .eq("id", productId)
    .maybeSingle<Pick<Product, "id" | "name" | "category_id">>();
  if (productError) {
    console.error("reviews: product lookup failed", productError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }
  if (!product) {
    return Response.json({ error: "product_not_found" }, { status: 404 });
  }

  let pieceIds: string[];
  try {
    pieceIds = await getPieceProductIds(supabase, product);
  } catch (err) {
    console.error("reviews: piece lookup failed", err);
    return Response.json({ error: "service_error" }, { status: 500 });
  }
  if (pieceIds.length === 0) pieceIds = [product.id];

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("*")
    .in("product_id", pieceIds)
    .order("created_at", { ascending: false })
    .returns<Review[]>();
  if (error) {
    console.error("reviews: list failed", error);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  const list = reviews ?? [];
  return Response.json(
    { reviews: list, summary: computeRatingSummary(list) },
    { status: 200 },
  );
}
