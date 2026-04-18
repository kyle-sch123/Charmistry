"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Product, ProductWithCategory } from "@/types";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/stores/cart";

interface ProductCardProps {
  product: Product | ProductWithCategory;
  size?: "normal" | "large";
  variant?: "dark" | "light";
}

const badgeStyles = {
  NEW: "bg-gold text-obsidian",
  BESTSELLER: "bg-champagne text-obsidian",
  LIMITED: "border border-gold text-gold",
};

export default function ProductCard({
  product,
  size = "normal",
  variant = "dark",
}: ProductCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), {
    stiffness: 200,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), {
    stiffness: 200,
    damping: 20,
  });

  const addItem = useCart((s) => s.addItem);

  const handleMouse = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product as Product, 1);
  };

  const soldOut = !product.in_stock || (product.quantity ?? 0) <= 0;

  const titleClass =
    variant === "light"
      ? "font-display text-xl text-ink font-semibold tracking-wide"
      : "font-display text-xl text-ivory font-semibold tracking-wide";
  const priceClass =
    variant === "light"
      ? "text-ink font-body text-sm font-light"
      : "text-gold font-body text-sm font-light";
  const ratingLabelClass = variant === "light" ? "text-ink/50" : "text-smoke";
  const hoverBtn =
    variant === "light"
      ? "border border-ink/70 text-ink hover:bg-ink hover:text-paper"
      : "border border-ivory/80 text-ivory hover:bg-ivory hover:text-obsidian";
  const mobileBtn =
    variant === "light"
      ? "border border-ink/30 text-ink active:bg-ink active:text-paper"
      : "border border-ivory/30 text-ivory active:bg-ivory active:text-obsidian";
  const imageBg = variant === "light" ? "bg-stone" : "bg-charcoal";

  return (
    <Link
      href={`/products/${product.slug}`}
      className="block group"
      aria-label={product.name}
    >
      <motion.div
        ref={cardRef}
        className="relative flex flex-col"
        style={{ perspective: 800 }}
        onMouseMove={handleMouse}
        onMouseLeave={handleMouseLeave}
        whileHover="hover"
      >
        <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
          <div
            className={`relative overflow-hidden ${imageBg} ${
              size === "large" ? "aspect-[3/4]" : "aspect-square"
            }`}
          >
            <Image
              src={product.image_url || "/placeholder.webp"}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes={
                size === "large"
                  ? "(max-width: 768px) 100vw, 50vw"
                  : "(max-width: 768px) 50vw, 25vw"
              }
            />

            {/* Shine effect on hover */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none"
              initial={{ opacity: 0, x: "-100%" }}
              variants={{ hover: { opacity: 1, x: "100%" } }}
              transition={{ duration: 0.6 }}
            />

            {product.badge && badgeStyles[product.badge] && (
              <span
                className={`absolute top-3 left-3 px-3 py-1 text-[10px] tracking-[0.15em] uppercase font-body font-medium ${badgeStyles[product.badge]}`}
              >
                {product.badge}
              </span>
            )}

            {/* Desktop: hover-reveal CTA */}
            <motion.div
              className="hidden md:block absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent"
              initial={{ opacity: 0, y: 10 }}
              variants={{ hover: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.3 }}
            >
              <button
                onClick={handleAdd}
                disabled={soldOut}
                className={`w-full py-2.5 text-xs tracking-[0.15em] uppercase font-body transition-colors duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${hoverBtn}`}
              >
                {soldOut ? "Sold Out" : "Add to Bag"}
              </button>
            </motion.div>
          </div>
        </motion.div>

        {/* Mobile: permanent CTA */}
        <button
          onClick={handleAdd}
          disabled={soldOut}
          className={`md:hidden w-full mt-2 py-2.5 text-xs tracking-[0.15em] uppercase font-body transition-colors duration-200 cursor-pointer min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed ${mobileBtn}`}
        >
          {soldOut ? "Sold Out" : "Add to Bag"}
        </button>

        <div className="pt-4 pb-2">
          <h3 className={titleClass}>{product.name}</h3>
          <div className="flex items-center justify-between mt-1">
            <span className={priceClass}>{formatPrice(product.price)}</span>
            {product.rating != null && (
              <div className="flex items-center gap-1">
                <svg
                  className="w-3 h-3 text-gold"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className={`text-xs ${ratingLabelClass}`}>{product.rating}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
