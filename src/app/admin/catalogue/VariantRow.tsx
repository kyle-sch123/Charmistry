/**
 * One editable variant row (a single (name, metal) product). Fields are held as
 * strings in the parent's working state so intermediate typing is smooth; the
 * parent coerces + validates on save.
 */

"use client";

import type { BadgeType, MetalType } from "@/types";
import {
  AdminField,
  AdminSelect,
  BADGE_OPTIONS,
  METAL_OPTIONS,
  sizeLabel,
} from "./shared";
import ImageManager from "./ImageManager";

type AdminRequest = (input: string, init?: RequestInit) => Promise<Response>;

export interface EditableVariant {
  id?: string;
  metal: MetalType | "";
  badge: BadgeType | "";
  price: string;
  quantity: string;
  in_stock: boolean;
  size: string;
  /** This variant's own gallery. Managed live by ImageManager (self-persists). */
  images: string[];
}

export default function VariantRow({
  variant,
  onChange,
  onRemove,
  removable,
  pieceName,
  request,
}: {
  variant: EditableVariant;
  onChange: (patch: Partial<EditableVariant>) => void;
  onRemove?: () => void;
  removable?: boolean;
  /** When present with a saved variant id, enables per-variant photo management. */
  pieceName?: string;
  request?: AdminRequest;
}) {
  const preview = sizeLabel(variant.size);

  return (
    <div className="border border-ink/10 bg-paper-warm/40 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminSelect
          label="Metal"
          value={variant.metal}
          onChange={(v) => onChange({ metal: v })}
          options={METAL_OPTIONS}
          placeholder="No metal"
        />
        <AdminField
          label="Price (R)"
          type="number"
          value={variant.price}
          onChange={(v) => onChange({ price: v })}
        />
        <AdminField
          label="Quantity"
          type="number"
          value={variant.quantity}
          onChange={(v) => onChange({ quantity: v })}
        />
        <AdminSelect
          label="Badge"
          value={variant.badge}
          onChange={(v) => onChange({ badge: v })}
          options={BADGE_OPTIONS}
          placeholder="None"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <AdminField
            label={`Size${preview ? ` — ${preview}` : ""}`}
            value={variant.size}
            onChange={(v) => onChange({ size: v })}
            placeholder="e.g. 45 (cm), or use a preset"
          />
          <div className="mt-1.5 flex gap-2">
            <PresetBtn label="Adjustable" onClick={() => onChange({ size: "0" })} />
            <PresetBtn label="Box 9×10cm" onClick={() => onChange({ size: "-1" })} />
            <PresetBtn label="Clear" onClick={() => onChange({ size: "" })} />
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-body text-ink">
            <input
              type="checkbox"
              checked={variant.in_stock}
              onChange={(e) => onChange({ in_stock: e.target.checked })}
              className="h-4 w-4 accent-ink"
            />
            In stock
          </label>
          {removable && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-[11px] uppercase tracking-[0.15em] text-red-600 hover:text-red-700 cursor-pointer"
            >
              Remove variant
            </button>
          )}
        </div>
      </div>

      {variant.id && pieceName && request ? (
        <div className="border-t border-ink/10 pt-3">
          <ImageManager
            pieceName={pieceName}
            ids={[variant.id]}
            images={variant.images}
            onChange={(imgs) => onChange({ images: imgs })}
            request={request}
          />
        </div>
      ) : (
        request && (
          <p className="border-t border-ink/10 pt-3 text-[11px] text-ink/45 font-body">
            Save the product first, then add photos to this variant.
          </p>
        )
      )}
    </div>
  );
}

function PresetBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-ink/15 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-ink/60 hover:border-ink hover:text-ink transition-colors cursor-pointer"
    >
      {label}
    </button>
  );
}
