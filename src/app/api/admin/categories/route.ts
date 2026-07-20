/**
 * Admin category endpoint for the /admin/catalogue tool.
 *
 * Auth: `x-admin-key` == ADMIN_FULFILMENT_KEY. Service-role client (RLS is
 * anon-read-only on categories).
 *
 * GET    — categories with product counts (mirrors getCategories()).
 * POST   — create { name, slug, description? }. Slug must be lowercase-hyphen.
 * PATCH  — { id, name?, description?, image_url? }.
 * DELETE — { id }. products.category_id is ON DELETE SET NULL, so a category's
 *          products are orphaned (uncategorised), never deleted.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import { isAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t === "" ? null : t;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabase();
  const [{ data: categories, error }, { data: counts, error: countError }] =
    await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("products").select("category_id"),
    ]);

  if (error || countError) {
    console.error("Admin categories GET failed", error ?? countError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  const countMap = new Map<string, number>();
  for (const row of counts ?? []) {
    if (row.category_id) {
      countMap.set(row.category_id, (countMap.get(row.category_id) ?? 0) + 1);
    }
  }

  return Response.json({
    categories: (categories ?? []).map((c) => ({
      ...c,
      product_count: countMap.get(c.id) ?? 0,
    })),
  });
}

interface PostBody {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = cleanText(body.name);
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!name) return Response.json({ error: "name_required" }, { status: 400 });
  if (!SLUG_RE.test(slug)) {
    return Response.json({ error: "invalid_slug" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name, slug, description: cleanText(body.description) })
    .select()
    .single();

  if (error) {
    console.error("Admin categories POST failed", error);
    const status = error.code === "23505" ? 409 : 500;
    return Response.json(
      { error: status === 409 ? "slug_taken" : "service_error" },
      { status },
    );
  }

  return Response.json({ ok: true, category: data });
}

interface PatchBody {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  image_url?: unknown;
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!UUID_RE.test(id)) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = cleanText(body.name);
    if (!name) return Response.json({ error: "name_required" }, { status: 400 });
    update.name = name;
  }
  if (body.description !== undefined) update.description = cleanText(body.description);
  if (body.image_url !== undefined) update.image_url = cleanText(body.image_url);
  if (Object.keys(update).length === 0) {
    return Response.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.from("categories").update(update).eq("id", id);
  if (error) {
    console.error("Admin categories PATCH failed", error);
    return Response.json({ error: "service_error" }, { status: 500 });
  }
  return Response.json({ ok: true });
}

interface DeleteBody {
  id?: unknown;
}

export async function DELETE(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!UUID_RE.test(id)) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    console.error("Admin categories DELETE failed", error);
    return Response.json({ error: "service_error" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
