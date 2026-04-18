"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import type { MetalType, ProductWithCategory } from "@/types";
import { useCart } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";

interface Props {
  product: ProductWithCategory;
  /** All products sharing name+category (metal variants). Includes the current product. */
  variants?: ProductWithCategory[];
}

const metalLabels: Record<MetalType, string> = {
  gold: "Gold",
  silver: "Silver",
  rose_gold: "Rose Gold",
  white_gold: "White Gold",
  platinum: "Platinum",
};

// Thin bar gradients — evoke a polished metal bar sample rather than a colour chip
const metalSwatch: Record<MetalType, string> = {
  gold: "linear-gradient(90deg, #B8862A 0%, #E8C96A 40%, #F5E6C8 60%, #C9A84C 100%)",
  silver: "linear-gradient(90deg, #7A7A7E 0%, #D4D4D4 40%, #F0F0F0 60%, #A8A8AC 100%)",
  rose_gold: "linear-gradient(90deg, #9E5C4E 0%, #D99080 40%, #F5C4B8 60%, #C07060 100%)",
  white_gold: "linear-gradient(90deg, #888888 0%, #D8D8D8 40%, #F5F5F5 60%, #AFAFAF 100%)",
  platinum: "linear-gradient(90deg, #5A5A5E 0%, #B8B8BC 40%, #E8E8EA 60%, #909094 100%)",
};

// Combine a product's own images[] (array col) with its legacy image_url,
// preserving order and filtering out empty values.
function imagesFor(p: ProductWithCategory): string[] {
  const arr = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  if (arr.length > 0) return arr;
  return p.image_url ? [p.image_url] : [];
}

export default function ProductDetail({ product, variants = [] }: Props) {
  // Deduped sibling list: always includes current product.
  const allVariants = useMemo(() => {
    const map = new Map<string, ProductWithCategory>();
    for (const v of [product, ...variants]) {
      if (!map.has(v.id)) map.set(v.id, v);
    }
    return Array.from(map.values());
  }, [product, variants]);

  const hasMultipleMetals =
    allVariants.length > 1 && allVariants.some((v) => v.metal);

  // Client-side selected variant — starts as the product the page was loaded for.
  const [selectedVariant, setSelectedVariant] = useState<ProductWithCategory>(product);

  // Gallery: selected variant's images first, then remaining siblings — deduped.
  const gallery = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (src: string) => {
      if (!seen.has(src)) {
        seen.add(src);
        out.push(src);
      }
    };
    for (const src of imagesFor(selectedVariant)) push(src);
    for (const v of allVariants) {
      if (v.id === selectedVariant.id) continue;
      for (const src of imagesFor(v)) push(src);
    }
    return out;
  }, [selectedVariant, allVariants]);

  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const selectVariant = (v: ProductWithCategory) => {
    if (v.id === selectedVariant.id) return;
    setSelectedVariant(v);
    setActiveImage(0);
  };

  const addItem = useCart((s) => s.addItem);
  const maxQty = selectedVariant.quantity ?? 0;
  const disabled = !selectedVariant.in_stock || maxQty <= 0;

  const handleAdd = () => {
    if (disabled) return;
    addItem(selectedVariant, quantity);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-16">
      {/* Gallery */}
      <div className="flex flex-col-reverse md:flex-row gap-4">
        {gallery.length > 1 && (
          <div className="flex md:flex-col gap-3 md:w-20">
            {gallery.map((src, i) => (
              <button
                key={`${src}-${i}`}
                onClick={() => setActiveImage(i)}
                className={`relative aspect-square w-16 md:w-20 overflow-hidden bg-stone transition-all cursor-pointer ${
                  activeImage === i
                    ? "ring-1 ring-ink"
                    : "opacity-60 hover:opacity-100"
                }`}
                aria-label={`View image ${i + 1}`}
              >
                <Image
                  src={src}
                  alt={`${product.name} thumbnail ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </button>
            ))}
          </div>
        )}

        <div className="relative flex-1 aspect-[4/5] overflow-hidden bg-stone">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeImage}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              {gallery[activeImage] && (
                <Image
                  src={gallery[activeImage]}
                  alt={product.name}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 55vw"
                />
              )}
            </motion.div>
          </AnimatePresence>
          {selectedVariant.badge && (
            <span className="absolute top-5 left-5 px-3 py-1 bg-ink text-paper text-[10px] tracking-[0.2em] uppercase font-body">
              {selectedVariant.badge}
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-col">
        {product.categories && (
          <p className="text-[11px] tracking-[0.25em] uppercase text-ink/55 font-body mb-3">
            {product.categories.name}
          </p>
        )}
        <h1 className="font-display text-4xl md:text-5xl font-light leading-tight">
          {selectedVariant.name}
        </h1>

        <div className="mt-5 flex items-center gap-4">
          <span className="font-display text-2xl md:text-3xl">
            {formatPrice(selectedVariant.price)}
          </span>
          {selectedVariant.rating != null && selectedVariant.review_count > 0 && (
            <div className="flex items-center gap-1.5 text-ink/60 text-sm">
              <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>{selectedVariant.rating}</span>
              <span className="text-ink/40">({selectedVariant.review_count})</span>
            </div>
          )}
        </div>

        <div className="my-8 h-px bg-ink/10" />

        {selectedVariant.description && (
          <p className="font-body text-[15px] leading-relaxed text-ink/75">
            {selectedVariant.description}
          </p>
        )}

        {/* Metal variant selector */}
        {hasMultipleMetals && (
          <div className="mt-8">
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-[11px] tracking-[0.2em] uppercase text-ink/55 font-body">
                Metal
              </p>
              <p className="text-sm font-body text-ink/80">
                {selectedVariant.metal ? metalLabels[selectedVariant.metal] : "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {allVariants.map((v) => {
                const isActive = v.id === selectedVariant.id;
                const label = v.metal ? metalLabels[v.metal] : "Classic";
                const swatch = v.metal ? metalSwatch[v.metal] : undefined;
                const soldOut = !v.in_stock || (v.quantity ?? 0) <= 0;

                return (
                  <button
                    key={v.id}
                    onClick={() => selectVariant(v)}
                    aria-pressed={isActive}
                    aria-label={`${label}${soldOut ? " (sold out)" : ""}`}
                    disabled={soldOut && !isActive}
                    className={`flex flex-col items-start gap-2 px-4 pt-2.5 pb-3 border transition-all duration-200 cursor-pointer disabled:cursor-not-allowed ${
                      isActive
                        ? "border-ink"
                        : "border-ink/20 hover:border-ink/50"
                    } ${soldOut ? "opacity-40" : ""}`}
                  >
                    {/* Metal bar swatch — looks like a polished sample strip */}
                    {swatch && (
                      <span
                        className="block w-full h-[3px] rounded-[1px]"
                        style={{ background: swatch }}
                        aria-hidden
                      />
                    )}
                    <span className={`text-[11px] tracking-[0.15em] uppercase font-body transition-colors ${
                      isActive ? "text-ink" : "text-ink/55"
                    }`}>
                      {label}
                    </span>
                    {soldOut && (
                      <span className="text-[9px] tracking-[0.1em] uppercase text-ink/40 -mt-1">
                        Sold out
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <dl className="mt-8 grid grid-cols-2 gap-y-4 text-sm">
          {selectedVariant.metal && !hasMultipleMetals && (
            <>
              <dt className="text-[11px] tracking-[0.2em] uppercase text-ink/50 font-body">
                Metal
              </dt>
              <dd className="font-body text-ink/80">
                {metalLabels[selectedVariant.metal] ?? selectedVariant.metal}
              </dd>
            </>
          )}
          <dt className="text-[11px] tracking-[0.2em] uppercase text-ink/50 font-body">
            Availability
          </dt>
          <dd className="font-body text-ink/80">
            {disabled ? (
              <span className="text-ink/50">Out of stock</span>
            ) : maxQty <= 5 ? (
              <span className="text-gold-dark">Only {maxQty} left</span>
            ) : (
              "In stock"
            )}
          </dd>
        </dl>

        <div className="mt-10 flex items-stretch gap-3">
          <div className="flex items-center border border-ink/15">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-11 h-12 flex items-center justify-center text-ink/70 hover:text-ink cursor-pointer disabled:opacity-30"
              disabled={quantity <= 1 || disabled}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-10 text-center font-body tabular-nums">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => Math.min(maxQty || q + 1, q + 1))}
              className="w-11 h-12 flex items-center justify-center text-ink/70 hover:text-ink cursor-pointer disabled:opacity-30"
              disabled={disabled || quantity >= maxQty}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <button
            onClick={handleAdd}
            disabled={disabled}
            className="relative flex-1 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer overflow-hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={justAdded ? "added" : "add"}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -16, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="inline-block"
              >
                {disabled ? "Sold out" : justAdded ? "Added to bag ✓" : "Add to bag"}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        <ul className="mt-10 space-y-3 text-xs text-ink/60 font-body">
          <li className="flex items-center gap-3">
            <span className="w-1 h-1 bg-gold rounded-full" />
            Complimentary shipping on orders over R500
          </li>
          <li className="flex items-center gap-3">
            <span className="w-1 h-1 bg-gold rounded-full" />
            30-day easy returns
          </li>
          <li className="flex items-center gap-3">
            <span className="w-1 h-1 bg-gold rounded-full" />
            Handcrafted in South Africa
          </li>
        </ul>
      </div>
    </div>
  );
}
