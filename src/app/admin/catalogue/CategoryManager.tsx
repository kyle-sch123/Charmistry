/**
 * Lightweight category CRUD. Deleting a category orphans its products
 * (products.category_id is ON DELETE SET NULL) — they stay in the shop,
 * uncategorised. New slugs outside the built-in set won't get a dedicated
 * shop landing page until code is added, so we warn on those.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { CategoryType } from "@/types";
import type { AdminCategory } from "./shared";
import { AdminField } from "./shared";
import { slugify } from "@/lib/admin-catalogue";

type AdminRequest = (input: string, init?: RequestInit) => Promise<Response>;

const KNOWN_SLUGS: CategoryType[] = [
  "rings",
  "necklaces",
  "earrings",
  "bracelets",
  "jewellery-boxes",
];

export default function CategoryManager({
  request,
  onChanged,
}: {
  request: AdminRequest;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<AdminCategory[] | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await request("/api/admin/categories", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { categories: AdminCategory[] };
      setCats(data.categories);
    }
  }, [request]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && cats === null) load();
  }, [open, cats, load]);

  async function create() {
    const s = slug.trim() || slugify(name);
    if (!name.trim() || !s) {
      setError("Name and slug are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await request("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: s }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error === "slug_taken" ? "That slug is taken." : "Couldn't create category.");
        return;
      }
      setName("");
      setSlug("");
      await load();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function rename(cat: AdminCategory) {
    const next = prompt(`Rename "${cat.name}" to:`, cat.name);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === cat.name) return;
    const res = await request("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, name: trimmed }),
    });
    if (res.ok) {
      await load();
      onChanged();
    }
  }

  async function remove(cat: AdminCategory) {
    if (
      !confirm(
        `Delete "${cat.name}"? Its ${cat.product_count ?? 0} product(s) will become uncategorised (not deleted).`,
      )
    ) {
      return;
    }
    const res = await request("/api/admin/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id }),
    });
    if (res.ok) {
      await load();
      onChanged();
    }
  }

  const effectiveSlug = slug.trim() || slugify(name);
  const unknownSlug = effectiveSlug !== "" && !KNOWN_SLUGS.includes(effectiveSlug as CategoryType);

  return (
    <div className="border border-ink/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left cursor-pointer"
      >
        <span className="text-[11px] tracking-[0.2em] uppercase text-ink/60 font-body">
          Categories
        </span>
        <span className="text-ink/40 text-sm">{open ? "–" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-ink/10 px-5 py-4">
          <div className="space-y-2">
            {(cats ?? []).map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between border border-ink/10 px-3 py-2"
              >
                <span className="font-body text-sm text-ink">
                  {cat.name}
                  <span className="text-ink/40"> · /{cat.slug} · {cat.product_count ?? 0}</span>
                </span>
                <span className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => rename(cat)}
                    className="text-[10px] uppercase tracking-[0.1em] text-ink/55 hover:text-ink cursor-pointer"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(cat)}
                    className="text-[10px] uppercase tracking-[0.1em] text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
            {cats && cats.length === 0 && (
              <p className="text-[12px] text-ink/45 font-body">No categories yet.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-ink/10 pt-4 md:grid-cols-2">
            <AdminField label="New category name" value={name} onChange={setName} placeholder="e.g. Anklets" />
            <AdminField
              label="Slug"
              value={slug}
              onChange={setSlug}
              placeholder={slugify(name) || "auto from name"}
            />
          </div>
          {unknownSlug && (
            <p className="text-[11px] text-amber-700 font-body">
              “{effectiveSlug}” isn’t one of the built-in categories — products will still
              show in the shop, but this category won’t have its own landing page until it’s
              added in code.
            </p>
          )}
          {error && <p className="text-[12px] text-red-600 font-body">{error}</p>}
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="bg-ink px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-paper hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add category"}
          </button>
        </div>
      )}
    </div>
  );
}
