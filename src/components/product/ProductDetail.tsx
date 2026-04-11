"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import type { ProductWithCategory } from "@/types";
import { useCart } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";

interface Props {
  product: ProductWithCategory;
}

const metalLabels: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  rose_gold: "Rose Gold",
  white_gold: "White Gold",
  platinum: "Platinum",
};

export default function ProductDetail({ product }: Props) {
  const gallery = useMemo(() => {
    const fromDb = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
    if (fromDb.length > 0) return fromDb;
    return product.image_url ? [product.image_url] : [];
  }, [product]);

  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const addItem = useCart((s) => s.addItem);
  const maxQty = product.quantity ?? 0;
  const disabled = !product.in_stock || maxQty <= 0;

  const handleAdd = () => {
    if (disabled) return;
    addItem(product, quantity);
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
                className={`relative aspect-square w-16 md:w-20 overflow-hidden bg-stone transition-all ${
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
          {product.badge && (
            <span className="absolute top-5 left-5 px-3 py-1 bg-ink text-paper text-[10px] tracking-[0.2em] uppercase font-body">
              {product.badge}
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
          {product.name}
        </h1>

        <div className="mt-5 flex items-center gap-4">
          <span className="font-display text-2xl md:text-3xl">
            {formatPrice(product.price)}
          </span>
          {product.rating != null && product.review_count > 0 && (
            <div className="flex items-center gap-1.5 text-ink/60 text-sm">
              <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>{product.rating}</span>
              <span className="text-ink/40">({product.review_count})</span>
            </div>
          )}
        </div>

        <div className="my-8 h-px bg-ink/10" />

        {product.description && (
          <p className="font-body text-[15px] leading-relaxed text-ink/75">
            {product.description}
          </p>
        )}

        <dl className="mt-8 grid grid-cols-2 gap-y-4 text-sm">
          {product.metal && (
            <>
              <dt className="text-[11px] tracking-[0.2em] uppercase text-ink/50 font-body">
                Metal
              </dt>
              <dd className="font-body text-ink/80">
                {metalLabels[product.metal] ?? product.metal}
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
