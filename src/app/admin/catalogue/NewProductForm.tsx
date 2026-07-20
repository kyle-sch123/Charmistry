/**
 * Create a brand-new piece with one or more metal variants. Slugs are generated
 * server-side. Photos are added afterwards by opening the new piece's editor.
 */

"use client";

import { useState } from "react";
import type { AdminCategory } from "./shared";
import { AdminField, AdminSelect, AdminTextarea } from "./shared";
import VariantRow, { type EditableVariant } from "./VariantRow";

type AdminRequest = (input: string, init?: RequestInit) => Promise<Response>;

const blankVariant = (): EditableVariant => ({
  metal: "",
  badge: "",
  price: "",
  quantity: "0",
  in_stock: false,
  size: "",
  images: [],
});

export default function NewProductForm({
  categories,
  request,
  onCreated,
}: {
  categories: AdminCategory[];
  request: AdminRequest;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [material, setMaterial] = useState("");
  const [variants, setVariants] = useState<EditableVariant[]>([blankVariant()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setCategoryId("");
    setDescription("");
    setMaterial("");
    setVariants([blankVariant()]);
    setError(null);
  }

  function patchVariant(index: number, patch: Partial<EditableVariant>) {
    setVariants((cur) => cur.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  async function submit() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    for (const v of variants) {
      const price = Number(v.price);
      if (!Number.isFinite(price) || price < 0) {
        setError("Every variant needs a price ≥ 0.");
        return;
      }
      const qty = Number(v.quantity);
      if (!Number.isInteger(qty) || qty < 0) {
        setError("Every quantity must be a whole number ≥ 0.");
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await request("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category_id: categoryId || null,
          description,
          material,
          variants: variants.map((v) => ({
            metal: v.metal || null,
            badge: v.badge || null,
            price: Number(v.price),
            quantity: Number(v.quantity),
            in_stock: v.in_stock,
            size: v.size,
          })),
        }),
      });
      if (!res.ok) {
        setError("Couldn't create the product. Try again.");
        return;
      }
      reset();
      setOpen(false);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border border-dashed border-ink/25 py-4 text-xs uppercase tracking-[0.2em] text-ink/60 hover:border-ink hover:text-ink transition-colors cursor-pointer"
      >
        + New product
      </button>
    );
  }

  return (
    <div className="border border-ink bg-paper-warm/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-ink">New product</h2>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-[11px] uppercase tracking-[0.15em] text-ink/50 hover:text-ink cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <AdminField label="Name" value={name} onChange={setName} placeholder="e.g. Mila Bracelet" />
        <AdminSelect
          label="Category"
          value={categoryId}
          onChange={setCategoryId}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Uncategorised"
        />
      </div>

      <AdminField label="Material" value={material} onChange={setMaterial} placeholder="e.g. Stainless steel" />
      <AdminTextarea label="Description" value={description} onChange={setDescription} rows={3} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-[0.2em] uppercase text-ink/55 font-body">
            Variants
          </span>
          <button
            type="button"
            onClick={() => setVariants((cur) => [...cur, blankVariant()])}
            className="text-[11px] tracking-[0.15em] uppercase text-ink/60 hover:text-ink transition-colors cursor-pointer"
          >
            + Add metal variant
          </button>
        </div>
        {variants.map((v, i) => (
          <VariantRow
            key={i}
            variant={v}
            onChange={(patch) => patchVariant(i, patch)}
            onRemove={() => setVariants((cur) => cur.filter((_, idx) => idx !== i))}
            removable={variants.length > 1}
          />
        ))}
      </div>

      {error && <p className="text-[12px] text-red-600 font-body">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full bg-ink py-3 text-xs uppercase tracking-[0.2em] text-paper hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-60"
      >
        {submitting ? "Creating…" : "Create product"}
      </button>
      <p className="text-[11px] text-ink/45 font-body">
        Add photos after creating — open the new product below and use “Add photos”.
      </p>
    </div>
  );
}
