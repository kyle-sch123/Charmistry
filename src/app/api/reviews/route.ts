/**
 * Reviews endpoint — open writes + public list.
 *
 * Anyone may review any piece. There is no purchase gate (it left genuine
 * customers unable to review — guest checkouts, gifts, orders placed on another
 * account) and, since migration 012, no sign-in gate either: requiring an
 * account before a shopper could say anything is what kept the review count
 * near zero.
 *
 * Signing in is therefore optional, and it is the ONLY thing that changes:
 *
 *   signed in — identity comes from the verified session cookie
 *               (getVerifiedUser), never from the request body. The reviewer
 *               gets one review per piece (a second submit edits the first),
 *               plus edit and delete afterwards, plus the Klaviyo reward.
 *   guest     — user_id is null. Every submit inserts a new row, because
 *               there is no identity to key an update to, and for the same
 *               reason there is nothing to scope an edit or a delete to.
 *
 * A guest supplies only a display name, and it is treated as decoration, never
 * as identity — nothing is authorised off the back of it. The one thing a
 * guest genuinely cannot do is come back and change their mind.
 *
 * This is an unauthenticated write path and it is deliberately unthrottled;
 * see the note in migration 012_guest_reviews.sql.
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
 * DELETE removes the caller's own review for a piece. It is scoped to
 * `user_id = session user` on the server, so the productId in the query can
 * only ever reach the caller's own row — there is no way to spell a request
 * that deletes someone else's review, and no way for it to reach a guest row.
 *
 * author_name is the name the reviewer typed; blank falls back to their
 * profile "First L." snapshot when signed in, and finally to "Anonymous", so
 * the public read path never touches profiles.
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
  resolveAuthorName,
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
  // Optional. A null user is a guest review, not a rejected one — the only
  // thing a session buys a reviewer here is ownership (edit/delete) and the
  // Klaviyo reward.
  const user = await getVerifiedUser();

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

  // --- Make sure a signed-in reviewer has a profile --------------------------
  // Only for an account: the fallback author name is snapshotted from the
  // profile row, and a reviewer arriving straight from the client-side
  // email-OTP sign-in (next=/products/…) has never passed through the auth
  // routes or the /account layout that normally create it. This is the same
  // idempotent, never-throwing helper those paths use; it also
  // opportunistically attaches any guest orders matching the verified email,
  // which is harmless here and useful for the shopper's order history.
  //
  // A guest has no profile to create and no verified email to claim orders
  // with, so this whole step is skipped for them.
  let profile: Pick<Profile, "first_name" | "last_name"> | null = null;
  if (user) {
    await ensureProfileAndClaimOrders(user);
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle<Pick<Profile, "first_name" | "last_name">>();
    profile = data ?? null;
  }

  // --- Author name ----------------------------------------------------------
  // Typed name wins; blank falls back to the profile snapshot for an account
  // (so an account leaving the box empty keeps the "First L." it always had)
  // and to "Anonymous" for a guest.
  const authorName = resolveAuthorName(input.value.name, profile);

  // --- One review per ACCOUNT per piece -------------------------------------
  // Guests skip this entirely: with user_id null there is nothing to match on,
  // and `.eq("user_id", null)` would match some other guest's row — so every
  // guest submission inserts.
  let existing: Pick<Review, "id"> | null = null;
  if (user) {
    const { data, error: existingError } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", user.id)
      .in("product_id", pieceIds)
      .maybeSingle<Pick<Review, "id">>();
    if (existingError) {
      console.error("reviews: existing lookup failed", existingError);
      return Response.json({ error: "service_error" }, { status: 500 });
    }
    existing = data ?? null;
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
      .insert({ product_id: product.id, user_id: user?.id ?? null, ...values })
      .select("*")
      .single<Review>();
    if (error) {
      console.error("reviews: insert failed", error);
      return Response.json({ error: "service_error" }, { status: 500 });
    }
    saved = data;
  }

  await refreshPieceAggregate(supabase, pieceIds);

  // Reward the review via Klaviyo — but only for a NEW review by a SIGNED-IN
  // reviewer. Edits and reviews of a second variant of an already-reviewed
  // piece take the update path and must not re-trigger the coupon; guests are
  // excluded outright, because the reward is a discount code emailed to an
  // address, and a guest's only identity here is an unverified display name.
  // Issuing coupons off an unverified request body would be a free-money bug.
  // Best-effort: a Klaviyo failure never fails the already-saved review.
  if (!existing && saved && user?.email && isKlaviyoConfigured()) {
    try {
      await trackReviewSubmitted(user.email, profile ?? null, product, saved);
    } catch (err) {
      console.error("reviews: Klaviyo 'Submitted Review' event failed", err);
    }
  }

  return Response.json({ review: saved }, { status: existing ? 200 : 201 });
}

/**
 * DELETE /api/reviews?productId=<uuid> — remove the caller's own review of the
 * piece. Idempotent-ish: 404 when they have nothing to delete, so a double-tap
 * can't be mistaken for a permissions problem.
 *
 * Still sign-in only, and deliberately so: the delete is scoped by user_id, and
 * a guest review has none. There is no request a signed-out visitor can make
 * that removes anybody's review — including the one they just left.
 *
 * The Klaviyo "Submitted Review" event is deliberately NOT retracted — the
 * reward coupon has already been issued and dropping the review shouldn't try
 * to claw it back.
 */
export async function DELETE(request: Request) {
  const user = await getVerifiedUser();
  if (!user) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }

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

  // Scoped to this user AND this piece. The service role bypasses RLS, so the
  // user_id filter is the only thing standing between a request and someone
  // else's review — it is not optional.
  const { data: deleted, error: deleteError } = await supabase
    .from("reviews")
    .delete()
    .eq("user_id", user.id)
    .in("product_id", pieceIds)
    .select("id")
    .returns<Pick<Review, "id">[]>();
  if (deleteError) {
    console.error("reviews: delete failed", deleteError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return Response.json({ error: "review_not_found" }, { status: 404 });
  }

  await refreshPieceAggregate(supabase, pieceIds);

  return Response.json({ deleted: deleted.map((r) => r.id) }, { status: 200 });
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
