/**
 * Shared client types + form primitives for the /admin/catalogue tool.
 * Mirrors the look of FulfilClient's AdminField (uppercase micro-labels,
 * ink/paper tokens) so both admin tools feel like one surface.
 */

"use client";

import type { BadgeType, MetalType } from "@/types";
import { isAdjustableSize } from "@/lib/utils";

export const KEY_STORAGE = "charmistry-admin-key";

export const METAL_OPTIONS: { value: MetalType; label: string }[] = [
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "rose_gold", label: "Rose Gold" },
  { value: "white_gold", label: "White Gold" },
  { value: "platinum", label: "Platinum" },
];

export const BADGE_OPTIONS: { value: BadgeType; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "BESTSELLER", label: "Bestseller" },
  { value: "LIMITED", label: "Limited" },
];

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  product_count?: number;
}

export interface AdminVariant {
  id: string;
  slug: string;
  metal: MetalType | null;
  badge: BadgeType | null;
  price: number;
  quantity: number;
  in_stock: boolean;
  size: string | number | null;
  /** This variant's own gallery (per-metal), primary first. */
  images: string[];
}

export interface AdminPiece {
  key: string;
  name: string;
  category_id: string | null;
  categoryName: string | null;
  description: string | null;
  material: string | null;
  /** First available image across variants — for the collapsed row only. */
  thumbnail: string | null;
  variants: AdminVariant[];
}

/** Human-readable size label — mirrors ProductDetail.formatSize sentinels. */
export function sizeLabel(size: string | number | null | undefined): string | null {
  if (size === null || size === undefined || String(size).trim() === "") return null;
  const raw = String(size).trim();
  if (isAdjustableSize(raw)) return "Adjustable";
  if (raw === "-1" || raw === "-1.0") return "Box 9×10cm";
  if (/^\d+(\.\d+)?$/.test(raw)) return `${raw}cm`;
  return raw;
}

// ---- Form primitives ------------------------------------------------------

const labelCls =
  "block text-[10px] tracking-[0.2em] uppercase text-ink/55 font-body mb-1.5";
const inputCls =
  "w-full border border-ink/15 bg-paper px-3 py-2.5 text-sm font-body focus:outline-none focus:border-ink transition-colors";

export function AdminField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </label>
  );
}

export function AdminTextarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} resize-y`}
      />
    </label>
  );
}

export function AdminSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder = "—",
}: {
  label: string;
  value: T | "";
  onChange: (v: T | "") => void;
  options: { value: T; label: string }[];
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | "")}
        className={`${inputCls} cursor-pointer`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
