/**
 * Admin catalogue endpoint — reads every product row and writes edits, new
 * pieces, image ordering, and deletes for the /admin/catalogue tool.
 *
 * Auth: `x-admin-key` == ADMIN_FULFILMENT_KEY (see lib/admin-auth). Fail-closed.
 * All access uses the service-role client (bypasses RLS, which is anon-read-only
 * on products/categories). This deliberately does NOT go through lib/queries.ts:
 * that layer de-dupes variants for the storefront, whereas the admin needs every
 * (name, metal) row.
 *
 * GET    — all rows grouped into pieces (+ effective image list) and the
 *          category list, in one round-trip.
 * POST   — create a piece: one row per metal variant with unique slugs.
 * PATCH  — { op: "save" }  edit shared + per-variant fields for a piece.
 *          { op: "images" } set the ordered images[] (+ image_url) for a piece
 *          (reorder / set-primary / delete-from-gallery — no storage I/O).
 * DELETE — { op: "variant" } one row, or { op: "piece" } all rows + storage.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import { isAuthorized } from "@/lib/admin-auth";
import { BUCKET_NAME } from "@/lib/storage";
import {
  METALS,
  BADGES,
  slugify,
  pieceKey,
  isAbsoluteUrl,
  storagePathFromPublicUrl,
} from "@/lib/admin-catalogue";
import type { BadgeType, MetalType, Product } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProductRow = Product & { categories: { name: string; slug: string } | null };

// ---- Validation helpers ---------------------------------------------------

function cleanPrice(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Number(n.toFixed(2));
}

function cleanQuantity(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function cleanMetal(value: unknown): MetalType | null {
  return typeof value === "string" && (METALS as string[]).includes(value)
    ? (value as MetalType)
    : null;
}

function cleanBadge(value: unknown): BadgeType | null {
  return typeof value === "string" && (BADGES as string[]).includes(value)
    ? (value as BadgeType)
    : null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t === "" ? null : t;
}

// ---- GET ------------------------------------------------------------------

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabase();

  const [{ data: rows, error }, { data: categories, error: catError }] =
    await Promise.all([
      supabase
        .from("products")
        .select("*, categories(name, slug)")
        .order("name", { ascending: true })
        .order("metal", { ascending: true, nullsFirst: false })
        .returns<ProductRow[]>(),
      supabase.from("categories").select("id, name, slug").order("name"),
    ]);

  if (error || catError) {
    console.error("Admin catalogue GET failed", error ?? catError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  // Group variant rows into pieces (same key the shop grid uses).
  const pieces = new Map<
    string,
    {
      key: string;
      name: string;
      category_id: string | null;
      categoryName: string | null;
      description: string | null;
      material: string | null;
      variants: ProductRow[];
    }
  >();

  for (const row of rows ?? []) {
    const key = pieceKey(row.name, row.category_id);
    const existing = pieces.get(key);
    if (existing) {
      existing.variants.push(row);
      existing.description ??= row.description;
      existing.material ??= row.material;
    } else {
      pieces.set(key, {
        key,
        name: row.name,
        category_id: row.category_id,
        categoryName: row.categories?.name ?? null,
        description: row.description,
        material: row.material,
        variants: [row],
      });
    }
  }

  // Images are per-variant (each metal row has its own gallery, which the PDP
  // shows for the selected metal). Effective list: managed absolute URLs from
  // the row's images[] win; else the row's image_url; else empty.
  const effectiveImages = (row: ProductRow): string[] => {
    const managed = (row.images ?? []).filter(isAbsoluteUrl);
    if (managed.length > 0) return managed;
    if (row.image_url && isAbsoluteUrl(row.image_url)) return [row.image_url];
    return [];
  };

  const payload = Array.from(pieces.values()).map((piece) => {
    const variants = piece.variants.map((v) => ({
      id: v.id,
      slug: v.slug,
      metal: v.metal,
      badge: v.badge,
      price: Number(v.price),
      quantity: v.quantity,
      in_stock: v.in_stock,
      size: v.size,
      images: effectiveImages(v),
    }));
    const thumbnail = variants.find((v) => v.images.length > 0)?.images[0] ?? null;
    return {
      key: piece.key,
      name: piece.name,
      category_id: piece.category_id,
      categoryName: piece.categoryName,
      description: piece.description,
      material: piece.material,
      thumbnail,
      variants,
    };
  });

  return Response.json({ pieces: payload, categories: categories ?? [] });
}

// ---- POST (create piece) --------------------------------------------------

interface CreateVariant {
  metal?: unknown;
  price?: unknown;
  quantity?: unknown;
  in_stock?: unknown;
  size?: unknown;
  badge?: unknown;
}

interface CreateBody {
  name?: unknown;
  category_id?: unknown;
  description?: unknown;
  material?: unknown;
  variants?: unknown;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = cleanText(body.name);
  if (!name) return Response.json({ error: "name_required" }, { status: 400 });

  const base = slugify(name);
  if (!base) return Response.json({ error: "invalid_name" }, { status: 400 });

  const category_id =
    typeof body.category_id === "string" && UUID_RE.test(body.category_id)
      ? body.category_id
      : null;
  const description = cleanText(body.description);
  const material = cleanText(body.material);

  const rawVariants = Array.isArray(body.variants) ? body.variants : [];
  if (rawVariants.length === 0) {
    return Response.json({ error: "variants_required" }, { status: 400 });
  }

  const variants: {
    metal: MetalType | null;
    price: number;
    quantity: number;
    in_stock: boolean;
    size: string | null;
    badge: BadgeType | null;
  }[] = [];

  for (const raw of rawVariants as CreateVariant[]) {
    const price = cleanPrice(raw.price);
    if (price === null) {
      return Response.json({ error: "invalid_price" }, { status: 400 });
    }
    const quantity = cleanQuantity(raw.quantity) ?? 0;
    variants.push({
      metal: cleanMetal(raw.metal),
      price,
      quantity,
      in_stock: raw.in_stock === undefined ? quantity > 0 : Boolean(raw.in_stock),
      size: cleanText(raw.size),
      badge: cleanBadge(raw.badge),
    });
  }

  const supabase = createServerSupabase();

  // Reserve unique slugs up front so a partial multi-row insert can't happen.
  const { data: existing } = await supabase
    .from("products")
    .select("slug")
    .like("slug", `${base}%`);
  const taken = new Set((existing ?? []).map((r) => r.slug as string));

  const rowsToInsert = variants.map((v) => {
    let slug = v.metal ? `${base}-${slugify(v.metal)}` : base;
    if (taken.has(slug)) {
      let n = 2;
      while (taken.has(`${slug}-${n}`)) n += 1;
      slug = `${slug}-${n}`;
    }
    taken.add(slug);
    return {
      name,
      slug,
      description,
      price: v.price,
      category_id,
      metal: v.metal,
      badge: v.badge,
      material,
      size: v.size,
      images: [] as string[],
      image_url: null,
      in_stock: v.in_stock,
      quantity: v.quantity,
    };
  });

  const { data: inserted, error } = await supabase
    .from("products")
    .insert(rowsToInsert)
    .select("id, slug");

  if (error) {
    console.error("Admin catalogue POST failed", error);
    const status = error.code === "23505" ? 409 : 500;
    return Response.json(
      { error: status === 409 ? "slug_conflict" : "service_error" },
      { status },
    );
  }

  return Response.json({ ok: true, created: inserted ?? [] });
}

// ---- PATCH (edit / reorder images) ----------------------------------------

interface PatchVariant {
  id?: unknown;
  price?: unknown;
  quantity?: unknown;
  in_stock?: unknown;
  metal?: unknown;
  badge?: unknown;
  size?: unknown;
}

interface PatchBody {
  op?: unknown;
  shared?: {
    description?: unknown;
    material?: unknown;
    category_id?: unknown;
  };
  variants?: unknown;
  ids?: unknown;
  images?: unknown;
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

  const supabase = createServerSupabase();

  // -- images: set the ordered gallery (+ primary) across a piece's rows --
  if (body.op === "images") {
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((v): v is string => typeof v === "string" && UUID_RE.test(v))
      : [];
    const images = Array.isArray(body.images)
      ? body.images.filter(
          (v): v is string => typeof v === "string" && isAbsoluteUrl(v),
        )
      : [];
    if (ids.length === 0) {
      return Response.json({ error: "ids_required" }, { status: 400 });
    }
    const { error } = await supabase
      .from("products")
      .update({ images, image_url: images[0] ?? null })
      .in("id", ids);
    if (error) {
      console.error("Admin catalogue PATCH images failed", error);
      return Response.json({ error: "service_error" }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  // -- save: shared fields (all rows) + per-variant fields --
  if (body.op === "save") {
    const shared = body.shared ?? {};
    const category_id =
      typeof shared.category_id === "string" && UUID_RE.test(shared.category_id)
        ? shared.category_id
        : shared.category_id === null || shared.category_id === ""
          ? null
          : undefined; // undefined = leave unchanged
    const sharedFields: Record<string, unknown> = {
      description: cleanText(shared.description),
      material: cleanText(shared.material),
    };
    if (category_id !== undefined) sharedFields.category_id = category_id;

    const rawVariants = Array.isArray(body.variants) ? body.variants : [];
    if (rawVariants.length === 0) {
      return Response.json({ error: "variants_required" }, { status: 400 });
    }

    for (const raw of rawVariants as PatchVariant[]) {
      const id = typeof raw.id === "string" ? raw.id : "";
      if (!UUID_RE.test(id)) {
        return Response.json({ error: "invalid_variant_id" }, { status: 400 });
      }
      const price = cleanPrice(raw.price);
      if (price === null) {
        return Response.json({ error: "invalid_price" }, { status: 400 });
      }
      const quantity = cleanQuantity(raw.quantity);
      if (quantity === null) {
        return Response.json({ error: "invalid_quantity" }, { status: 400 });
      }
      const update: Record<string, unknown> = {
        ...sharedFields,
        price,
        quantity,
        in_stock: Boolean(raw.in_stock),
        metal: cleanMetal(raw.metal),
        badge: cleanBadge(raw.badge),
        size: cleanText(raw.size),
      };
      const { error } = await supabase
        .from("products")
        .update(update)
        .eq("id", id);
      if (error) {
        console.error("Admin catalogue PATCH save failed", error);
        return Response.json({ error: "service_error" }, { status: 500 });
      }
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "unknown_op" }, { status: 400 });
}

// ---- DELETE ---------------------------------------------------------------

interface DeleteBody {
  op?: unknown;
  id?: unknown;
  ids?: unknown;
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

  const supabase = createServerSupabase();

  if (body.op === "variant") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!UUID_RE.test(id)) {
      return Response.json({ error: "invalid_id" }, { status: 400 });
    }
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      console.error("Admin catalogue DELETE variant failed", error);
      return Response.json({ error: "service_error" }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  if (body.op === "piece") {
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((v): v is string => typeof v === "string" && UUID_RE.test(v))
      : [];
    if (ids.length === 0) {
      return Response.json({ error: "ids_required" }, { status: 400 });
    }

    // Best-effort storage cleanup: remove any managed photos these rows own.
    const { data: rows } = await supabase
      .from("products")
      .select("images")
      .in("id", ids)
      .returns<{ images: string[] }[]>();
    const paths = new Set<string>();
    for (const r of rows ?? []) {
      for (const url of r.images ?? []) {
        const p = storagePathFromPublicUrl(url);
        if (p) paths.add(p);
      }
    }
    if (paths.size > 0) {
      const { error: rmError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(Array.from(paths));
      if (rmError) console.warn("Admin catalogue: storage cleanup failed", rmError);
    }

    const { error } = await supabase.from("products").delete().in("id", ids);
    if (error) {
      console.error("Admin catalogue DELETE piece failed", error);
      return Response.json({ error: "service_error" }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "unknown_op" }, { status: 400 });
}
