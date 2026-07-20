/**
 * Admin catalogue image endpoint — stores product photos in Supabase Storage
 * and removes them. WebP conversion happens in the browser (the app runs on
 * Cloudflare Workers, where native encoders like sharp can't run); this route
 * only receives already-encoded WebP bytes.
 *
 * Auth: `x-admin-key` == ADMIN_FULFILMENT_KEY. Service-role client bypasses
 * Storage RLS for writes; the bucket stays public-read for the storefront.
 *
 * POST   — multipart { file (image/webp), name }. Uploads to
 *          products/<slug>/<uuid>.webp and returns { url, path }. The gallery
 *          order itself is persisted separately via PATCH /api/admin/products
 *          (op: "images"), so this route never guesses ordering.
 * DELETE — { url, ids }. Removes the storage object and strips the URL from the
 *          given rows' images[] (recomputing image_url).
 */

import crypto from "node:crypto";
import { createServerSupabase } from "@/lib/supabase-server";
import { isAuthorized } from "@/lib/admin-auth";
import { BUCKET_NAME } from "@/lib/storage";
import { slugify, storagePathFromPublicUrl, isAbsoluteUrl } from "@/lib/admin-catalogue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — WebP output should be far under this

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  const name = form.get("name");
  if (!(file instanceof Blob)) {
    return Response.json({ error: "file_required" }, { status: 400 });
  }
  if (file.type !== "image/webp") {
    return Response.json({ error: "not_webp" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return Response.json({ error: "bad_size" }, { status: 400 });
  }
  const slug = typeof name === "string" ? slugify(name) : "";
  if (!slug) {
    return Response.json({ error: "name_required" }, { status: 400 });
  }

  const path = `products/${slug}/${crypto.randomUUID()}.webp`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const supabase = createServerSupabase();
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, bytes, { contentType: "image/webp", upsert: true });
  if (error) {
    console.error("Admin catalogue image upload failed", error);
    return Response.json({ error: "upload_failed" }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return Response.json({ ok: true, url: data.publicUrl, path });
}

interface DeleteBody {
  url?: unknown;
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

  const url = typeof body.url === "string" && isAbsoluteUrl(body.url) ? body.url : "";
  if (!url) return Response.json({ error: "url_required" }, { status: 400 });
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === "string" && UUID_RE.test(v))
    : [];

  const supabase = createServerSupabase();

  const path = storagePathFromPublicUrl(url);
  if (path) {
    const { error: rmError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);
    if (rmError) console.warn("Admin catalogue image remove failed", rmError);
  }

  // Strip the URL from every affected row and keep image_url pointing at the
  // remaining primary.
  if (ids.length > 0) {
    const { data: rows } = await supabase
      .from("products")
      .select("id, images")
      .in("id", ids)
      .returns<{ id: string; images: string[] }[]>();
    for (const row of rows ?? []) {
      const next = (row.images ?? []).filter((u) => u !== url);
      const { error } = await supabase
        .from("products")
        .update({ images: next, image_url: next[0] ?? null })
        .eq("id", row.id);
      if (error) {
        console.error("Admin catalogue image strip failed", error);
        return Response.json({ error: "service_error" }, { status: 500 });
      }
    }
  }

  return Response.json({ ok: true });
}
