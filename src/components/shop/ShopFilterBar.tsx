/**
 * Filter + sort bar on the /shop page.
 *
 * Filter state lives entirely in the URL — every dropdown change calls
 * router.push() with the updated query string and the shop page re-renders
 * with the new params. That keeps links shareable and the back button
 * working, but means every filter change is a full server round-trip.
 *
 * Whitelisted enums (SORT_OPTIONS, METAL_OPTIONS) and a parseMetalsParam()
 * that drops unknown values prevent URL-injected garbage from reaching
 * Supabase.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { formatPrice } from "@/lib/utils";
import type { ShopSort } from "@/lib/queries";
import type { MetalType } from "@/types";

interface Props {
  total: number;
  priceBounds: { min: number; max: number };
}

const SORT_OPTIONS: { value: ShopSort; label: string }[] = [
  { value: "best-selling", label: "Best selling" },
  { value: "price-asc", label: "Price: Low to high" },
  { value: "price-desc", label: "Price: High to low" },
  { value: "newest", label: "Newest" },
  { value: "name-asc", label: "Alphabetical, A–Z" },
];

const METAL_OPTIONS: { value: MetalType; label: string; swatch: string }[] = [
  {
    value: "gold",
    label: "Gold",
    swatch: "linear-gradient(135deg, #F5E6C8 0%, #C9A84C 55%, #9A7B2F 100%)",
  },
  {
    value: "silver",
    label: "Silver",
    swatch: "linear-gradient(135deg, #F5F5F5 0%, #C8C8C8 55%, #8A8A8E 100%)",
  },
  {
    value: "rose_gold",
    label: "Rose Gold",
    swatch: "linear-gradient(135deg, #FFD7CC 0%, #E0A899 55%, #B4735F 100%)",
  },
  {
    value: "white_gold",
    label: "White Gold",
    swatch: "linear-gradient(135deg, #FAFAFA 0%, #E4E4E4 55%, #B4B4B4 100%)",
  },
  {
    value: "platinum",
    label: "Platinum",
    swatch: "linear-gradient(135deg, #F0F0F0 0%, #D2D2D2 55%, #9A9A9A 100%)",
  },
];

const ALLOWED_METALS = METAL_OPTIONS.map((m) => m.value);

const parseMetalsParam = (v: string | null): MetalType[] => {
  if (!v) return [];
  const set = new Set<MetalType>();
  for (const raw of v.split(",")) {
    const c = raw.trim() as MetalType;
    if (ALLOWED_METALS.includes(c)) set.add(c);
  }
  return [...set];
};

const sortLabel = (v: string | null): string =>
  SORT_OPTIONS.find((o) => o.value === v)?.label ?? "Best selling";

export default function ShopFilterBar({ total, priceBounds }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openMenu, setOpenMenu] = useState<
    "availability" | "price" | "metal" | "sort" | null
  >(null);
  const barRef = useRef<HTMLDivElement>(null);

  const inStockOnly = searchParams.get("in_stock") === "1";
  const minPrice = searchParams.get("min_price");
  const maxPrice = searchParams.get("max_price");
  const sort = searchParams.get("sort") ?? "best-selling";
  const selectedMetals = parseMetalsParam(searchParams.get("metals"));

  // Click-outside closes menus
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenMenu(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.push(qs ? `/shop?${qs}` : "/shop", { scroll: false });
    },
    [router, searchParams],
  );

  const priceSummary = (() => {
    if (minPrice && maxPrice) return `${formatPrice(Number(minPrice))} – ${formatPrice(Number(maxPrice))}`;
    if (minPrice) return `From ${formatPrice(Number(minPrice))}`;
    if (maxPrice) return `Up to ${formatPrice(Number(maxPrice))}`;
    return null;
  })();

  const availabilitySummary = inStockOnly ? "In stock" : null;

  const metalSummary = (() => {
    if (selectedMetals.length === 0) return null;
    if (selectedMetals.length === 1) {
      return METAL_OPTIONS.find((m) => m.value === selectedMetals[0])?.label ?? null;
    }
    return `${selectedMetals.length} selected`;
  })();

  const toggleMetal = (metal: MetalType) => {
    const next = new Set(selectedMetals);
    if (next.has(metal)) next.delete(metal);
    else next.add(metal);
    const ordered = ALLOWED_METALS.filter((m) => next.has(m));
    updateParams({ metals: ordered.length > 0 ? ordered.join(",") : null });
  };

  return (
    <div
      ref={barRef}
      className="relative flex flex-wrap items-center justify-between gap-y-4 gap-x-8 py-5 border-y border-ink/10"
    >
      {/* Left: filters */}
      <div className="flex items-center gap-6 md:gap-8">
        <span
          className="text-ink/40 uppercase hidden sm:inline"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            letterSpacing: "0.2em",
          }}
        >
          Filter:
        </span>

        <FilterTrigger
          label="Availability"
          summary={availabilitySummary}
          open={openMenu === "availability"}
          onToggle={() =>
            setOpenMenu(openMenu === "availability" ? null : "availability")
          }
        />

        <FilterTrigger
          label="Price"
          summary={priceSummary}
          open={openMenu === "price"}
          onToggle={() => setOpenMenu(openMenu === "price" ? null : "price")}
        />

        <FilterTrigger
          label="Metal"
          summary={metalSummary}
          open={openMenu === "metal"}
          onToggle={() => setOpenMenu(openMenu === "metal" ? null : "metal")}
        />
      </div>

      {/* Right: sort + count */}
      <div className="flex items-center gap-6 md:gap-8 ml-auto">
        <div className="flex items-center gap-3">
          <span
            className="text-ink/40 uppercase"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              letterSpacing: "0.2em",
            }}
          >
            Sort by:
          </span>
          <FilterTrigger
            label={sortLabel(sort)}
            open={openMenu === "sort"}
            onToggle={() => setOpenMenu(openMenu === "sort" ? null : "sort")}
            bold
          />
        </div>
        <span
          className="text-ink/50 tabular-nums hidden sm:inline"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            letterSpacing: "0.12em",
          }}
        >
          {total} {total === 1 ? "product" : "products"}
        </span>
      </div>

      {/* ── Menus ── */}
      <AnimatePresence>
        {openMenu === "availability" && (
          <Dropdown align="left" key="avail">
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <span
                className={`w-4 h-4 border flex items-center justify-center transition-colors ${
                  inStockOnly
                    ? "bg-ink border-ink"
                    : "border-ink/30 group-hover:border-ink/60"
                }`}
                aria-hidden
              >
                {inStockOnly && (
                  <svg viewBox="0 0 12 12" className="w-3 h-3 text-paper" fill="none">
                    <path
                      d="M2.5 6.5l2.5 2.5 4.5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={inStockOnly}
                onChange={(e) =>
                  updateParams({ in_stock: e.target.checked ? "1" : null })
                }
              />
              <span className="text-sm font-body text-ink">In stock only</span>
            </label>
            {inStockOnly && (
              <button
                onClick={() => updateParams({ in_stock: null })}
                className="mt-4 text-[10px] tracking-[0.2em] uppercase text-ink/50 hover:text-ink transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </Dropdown>
        )}

        {openMenu === "price" && (
          <Dropdown align="left" key="price">
            <PricePanel
              bounds={priceBounds}
              currentMin={minPrice ? Number(minPrice) : null}
              currentMax={maxPrice ? Number(maxPrice) : null}
              onApply={(min, max) =>
                updateParams({
                  min_price: min != null ? String(min) : null,
                  max_price: max != null ? String(max) : null,
                })
              }
            />
          </Dropdown>
        )}

        {openMenu === "metal" && (
          <Dropdown align="left" key="metal">
            <p className="text-[10px] tracking-[0.2em] uppercase text-ink/50 font-body mb-3">
              Metal
            </p>
            <ul className="flex flex-col gap-2.5 w-48">
              {METAL_OPTIONS.map((opt) => {
                const checked = selectedMetals.includes(opt.value);
                return (
                  <li key={opt.value}>
                    <label className="flex items-center gap-3 cursor-pointer select-none group">
                      <span
                        className={`w-4 h-4 border flex items-center justify-center transition-colors shrink-0 ${
                          checked
                            ? "bg-ink border-ink"
                            : "border-ink/30 group-hover:border-ink/60"
                        }`}
                        aria-hidden
                      >
                        {checked && (
                          <svg
                            viewBox="0 0 12 12"
                            className="w-3 h-3 text-paper"
                            fill="none"
                          >
                            <path
                              d="M2.5 6.5l2.5 2.5 4.5-5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleMetal(opt.value)}
                      />
                      <span
                        className="w-4 h-4 rounded-full ring-1 ring-ink/15 shrink-0"
                        style={{ background: opt.swatch }}
                        aria-hidden
                      />
                      <span className="text-sm font-body text-ink">{opt.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {selectedMetals.length > 0 && (
              <button
                onClick={() => updateParams({ metals: null })}
                className="mt-4 text-[10px] tracking-[0.2em] uppercase text-ink/50 hover:text-ink transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </Dropdown>
        )}

        {openMenu === "sort" && (
          <Dropdown align="right" key="sort">
            <ul className="flex flex-col -my-1">
              {SORT_OPTIONS.map((opt) => {
                const active = sort === opt.value;
                return (
                  <li key={opt.value}>
                    <button
                      onClick={() => {
                        updateParams({
                          sort: opt.value === "best-selling" ? null : opt.value,
                        });
                        setOpenMenu(null);
                      }}
                      className={`w-full text-left py-2 text-sm font-body transition-colors cursor-pointer ${
                        active ? "text-ink" : "text-ink/60 hover:text-ink"
                      }`}
                    >
                      {opt.label}
                      {active && <span className="ml-2 text-ink/40">·</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Dropdown>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterTrigger({
  label,
  summary,
  open,
  onToggle,
  bold = false,
}: {
  label: string;
  summary?: string | null;
  open: boolean;
  onToggle: () => void;
  bold?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className={`flex items-center gap-1.5 py-1 transition-colors cursor-pointer ${
        bold ? "text-ink" : "text-ink/80 hover:text-ink"
      }`}
    >
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      {summary && (
        <span
          className="text-ink/50"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            letterSpacing: "0.05em",
          }}
        >
          · {summary}
        </span>
      )}
      <svg
        className={`w-3.5 h-3.5 text-ink/50 transition-transform duration-200 ${
          open ? "rotate-180" : ""
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
}

function Dropdown({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "right";
}) {
  return (
    <motion.div
      className={`absolute top-full mt-2 z-30 min-w-[220px] bg-paper border border-ink/10 shadow-lg p-5 ${
        align === "left" ? "left-0" : "right-0"
      }`}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  );
}

function PricePanel({
  bounds,
  currentMin,
  currentMax,
  onApply,
}: {
  bounds: { min: number; max: number };
  currentMin: number | null;
  currentMax: number | null;
  onApply: (min: number | null, max: number | null) => void;
}) {
  const [min, setMin] = useState<string>(currentMin != null ? String(currentMin) : "");
  const [max, setMax] = useState<string>(currentMax != null ? String(currentMax) : "");

  const parse = (v: string): number | null => {
    if (!v.trim()) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let lo = parse(min);
    let hi = parse(max);
    if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
    onApply(lo, hi);
  };

  return (
    <form onSubmit={submit} className="w-56">
      <p className="text-[10px] tracking-[0.2em] uppercase text-ink/50 font-body mb-3">
        Price range
      </p>
      <p className="text-[11px] text-ink/50 font-body mb-4">
        {formatPrice(bounds.min)} – {formatPrice(bounds.max)}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex-1">
          <span className="sr-only">Minimum price</span>
          <div className="flex items-center border border-ink/20 focus-within:border-ink/60 transition-colors">
            <span className="pl-2 text-sm text-ink/50 font-body">R</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={String(bounds.min)}
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="w-full px-2 py-2 text-sm font-body bg-transparent focus:outline-none"
            />
          </div>
        </label>
        <span className="text-ink/30">–</span>
        <label className="flex-1">
          <span className="sr-only">Maximum price</span>
          <div className="flex items-center border border-ink/20 focus-within:border-ink/60 transition-colors">
            <span className="pl-2 text-sm text-ink/50 font-body">R</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={String(bounds.max)}
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="w-full px-2 py-2 text-sm font-body bg-transparent focus:outline-none"
            />
          </div>
        </label>
      </div>
      <div className="flex items-center justify-between mt-4">
        <button
          type="button"
          onClick={() => {
            setMin("");
            setMax("");
            onApply(null, null);
          }}
          className="text-[10px] tracking-[0.2em] uppercase text-ink/50 hover:text-ink transition-colors cursor-pointer"
        >
          Clear
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-ink text-paper text-[10px] tracking-[0.2em] uppercase font-body hover:opacity-80 transition-opacity cursor-pointer"
        >
          Apply
        </button>
      </div>
    </form>
  );
}
