/**
 * Reviews endpoint — purchase-gated writes + public list.
 *
 * Why a route (and not a direct browser RLS write like the wishlist): three
 * things must happen server-side with the service role, and none can be trusted
 * to the client —
 *   1. Purchase gate: the reviewer must own a PAID order containing the piece.
 *   2. Aggregate cache: products.rating / products.review_count are recomputed
 *      across every metal variant of the piece so the PDP header and shop cards
 *      stay accurate.
 *   3. One review per user per piece: the piece spans multiple product rows, so
 *      the upsert has to look across variant ids, not a single (user, product).
 *
 * Identity comes from the verified session cookie (getVerifiedUser) — never
 * from the request body. author_name is snapshotted from the profile as a
 * "First L." string so the public read path never touches profiles.
 *
 * Reviews are scoped to the logical piece: rows sharing (name, category_id).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getVerifiedUser } from "@/lib/auth/server";
import { ensureProfileAndClaimOrders } from "@/lib/account";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  computeRatingSummary,
  formatAuthorName,
  validateReviewInput,
} from "@/lib/reviews";
import type { Product, Profile, Review } from "@/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SupabaseServer = ReturnType<typeof createServerSupabase>;

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

  // --- Attach any unclaimed guest orders ------------------------------------
  // A buyer who checked out as a guest and only made an account afterwards may
  // still have paid orders sitting on user_id = null. Claiming normally happens
  // on the auth routes / the /account layout, but the client-side email-OTP
  // sign-in redirects straight back here (next=/products/…) without passing
  // through any of them, so the order would otherwise stay unattached and the
  // purchase gate below would wrongly reject a genuine buyer. This is the same
  // idempotent, email-matched, never-throwing claim; running it here closes
  // that gap regardless of how the user signed in.
  await ensureProfileAndClaimOrders(user);

  // --- Purchase gate --------------------------------------------------------
  // The reviewer must own a PAID order whose items include any variant of the
  // piece. Service role bypasses RLS, so scope explicitly to this user.
  const { data: purchased, error: purchaseError } = await supabase
    .from("order_items")
    .select("id, orders!inner(user_id, status)")
    .in("product_id", pieceIds)
    .eq("orders.user_id", user.id)
    .eq("orders.status", "paid")
    .limit(1);
  if (purchaseError) {
    console.error("reviews: purchase check failed", purchaseError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }
  if (!purchased || purchased.length === 0) {
    return Response.json({ error: "not_purchased" }, { status: 403 });
  }

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
