/**
 * One expandable "piece" (all metal variants sharing name + category). Edits
 * shared fields (description, material, category) once and per-variant fields
 * per row, plus manages the photo gallery. Name/slug are read-only in v1.
 *
 * Save semantics: existing rows go through PATCH op:"save"; any newly-added
 * variant rows (no id yet) are created via POST. Removing a saved variant
 * deletes that row immediately.
 */

"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/utils";
import type { AdminCategory, AdminPiece } from "./shared";
import { AdminSelect, AdminTextarea, AdminField } from "./shared";
import VariantRow, { type EditableVariant } from "./VariantRow";

type AdminRequest = (input: string, init?: RequestInit) => Promise<Response>;

function toEditable(v: AdminPiece["variants"][number]): EditableVariant {
  return {
    id: v.id,
    metal: v.metal ?? "",
    badge: v.badge ?? "",
    price: String(v.price),
    quantity: String(v.quantity),
    in_stock: v.in_stock,
    size: v.size === null || v.size === undefined ? "" : String(v.size),
    images: v.images ?? [],
  };
}

function validate(variants: EditableVariant[]): string | null {
  for (const v of variants) {
    const price = Number(v.price);
    if (!Number.isFinite(price) || price < 0) return "Every price must be a number ≥ 0.";
    const qty = Number(v.quantity);
    if (!Number.isInteger(qty) || qty < 0) return "Every quantity must be a whole number ≥ 0.";
  }
  return null;
}

function payloadVariant(v: EditableVariant) {
  return {
    id: v.id,
    metal: v.metal || null,
    badge: v.badge || null,
    price: Number(v.price),
    quantity: Number(v.quantity),
    in_stock: v.in_stock,
    size: v.size,
  };
}

export default function PieceEditor({
  piece,
  categories,
  request,
  onChanged,
}: {
  piece: AdminPiece;
  categories: AdminCategory[];
  request: AdminRequest;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(piece.description ?? "");
  const [material, setMaterial] = useState(piece.material ?? "");
  const [categoryId, setCategoryId] = useState(piece.category_id ?? "");
  const [variants, setVariants] = useState<EditableVariant[]>(
    piece.variants.map(toEditable),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const ids = variants.map((v) => v.id).filter((id): id is string => Boolean(id));
  const priceRange = (() => {
    const nums = piece.variants.map((v) => v.price);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return min === max ? formatPrice(min) : `${formatPrice(min)}–${formatPrice(max)}`;
  })();

  function patchVariant(index: number, patch: Partial<EditableVariant>) {
    setVariants((cur) => cur.map((v, i) => (i === index ? { ...v, ...patch } : v)));
    setSaved(false);
  }

  function addVariant() {
    setVariants((cur) => [
      ...cur,
      { metal: "", badge: "", price: "0", quantity: "0", in_stock: false, size: "", images: [] },
    ]);
    setSaved(false);
  }

  async function removeVariant(index: number) {
    const v = variants[index];
    if (variants.length <= 1) return;
    if (v.id) {
      if (!confirm("Delete this variant? This can't be undone.")) return;
      const res = await request("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "variant", id: v.id }),
      });
      if (!res.ok) {
        setError("Couldn't delete that variant.");
        return;
      }
    }
    setVariants((cur) => cur.filter((_, i) => i !== index));
  }

  async function save() {
    const err = validate(variants);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const shared = {
        description,
        material,
        category_id: categoryId || null,
      };
      const existing = variants.filter((v) => v.id);
      const created = variants.filter((v) => !v.id);

      if (existing.length > 0) {
        const res = await request("/api/admin/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            op: "save",
            shared,
            variants: existing.map(payloadVariant),
          }),
        });
        if (!res.ok) {
          setError("Save failed. Check the values and try again.");
          return;
        }
      }

      if (created.length > 0) {
        const res = await request("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: piece.name,
            category_id: categoryId || null,
            description,
            material,
            variants: created.map(payloadVariant),
          }),
        });
        if (!res.ok) {
          setError("New variant couldn't be created.");
          return;
        }
        onChanged(); // structural change — refetch to pick up new ids
      }

      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function deletePiece() {
    if (
      !confirm(
        `Delete "${piece.name}" and all ${variants.length} variant(s)? This can't be undone.`,
      )
    ) {
      return;
    }
    const res = await request("/api/admin/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "piece", ids }),
    });
    if (!res.ok) {
      setError("Couldn't delete this piece.");
      return;
    }
    onChanged();
  }

  return (
    <div className={`border ${open ? "border-ink" : "border-ink/15"}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left cursor-pointer"
      >
        {piece.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={piece.thumbnail}
            alt=""
            className="h-12 w-12 shrink-0 border border-ink/10 object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-dashed border-ink/20 text-[9px] text-ink/40">
            no img
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-lg text-ink truncate">{piece.name}</span>
            <span className="shrink-0 font-body text-sm text-ink">{priceRange}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-ink/50 font-body">
            {piece.categoryName ?? "Uncategorised"} · {variants.length} variant
            {variants.length === 1 ? "" : "s"}
            {saved && <span className="text-green-800"> · saved ✓</span>}
          </p>
        </div>
      </button>

      {open && (
        <div className="space-y-5 border-t border-ink/10 px-5 py-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <AdminSelect
              label="Category"
              value={categoryId}
              onChange={(v) => {
                setCategoryId(v);
                setSaved(false);
              }}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Uncategorised"
            />
            <div className="md:col-span-2">
              <AdminField
                label="Material"
                value={material}
                onChange={(v) => {
                  setMaterial(v);
                  setSaved(false);
                }}
                placeholder="e.g. Stainless steel"
              />
            </div>
          </div>

          <AdminTextarea
            label="Description"
            value={description}
            onChange={(v) => {
              setDescription(v);
              setSaved(false);
            }}
            rows={4}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.2em] uppercase text-ink/55 font-body">
                Variants
              </span>
              <button
                type="button"
                onClick={addVariant}
                className="text-[11px] tracking-[0.15em] uppercase text-ink/60 hover:text-ink transition-colors cursor-pointer"
              >
                + Add metal variant
              </button>
            </div>
            {variants.map((v, i) => (
              <VariantRow
                key={v.id ?? `new-${i}`}
                variant={v}
                onChange={(patch) => patchVariant(i, patch)}
                onRemove={() => removeVariant(i)}
                removable={variants.length > 1}
                pieceName={piece.name}
                request={request}
              />
            ))}
          </div>

          {error && <p className="text-[12px] text-red-600 font-body">{error}</p>}

          <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
            <button
              type="button"
              onClick={deletePiece}
              className="text-[11px] uppercase tracking-[0.15em] text-red-600 hover:text-red-700 cursor-pointer"
            >
              Delete piece
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-ink px-8 py-3 text-xs uppercase tracking-[0.2em] text-paper hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
