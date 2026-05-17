"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatPrice } from "@/lib/utils";
import { getBestsellers } from "@/lib/queries";
import type { ProductWithCategory } from "@/types";

export default function BestSellers() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getBestsellers(5)
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err) => {
        console.error("Failed to load bestsellers", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section
      id="collection"
      className="bg-paper pt-14 md:pt-20 pb-6 md:pb-8 scroll-mt-24"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16">
        {/* Header */}
        <motion.div
          className="flex items-start justify-between mb-10 md:mb-14"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2
            className="text-ink uppercase"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(2rem, 5vw, 4rem)",
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}
          >
            Bestsellers
          </h2>

          <motion.div className="hidden sm:flex w-full flex-col items-end">
            <p
              className="text-ink-tertiary"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "16px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginTop: "6px",
              }}
            >
              Shop the pieces people are
            </p>
            <p
              className="text-ink-tertiary italic"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "16px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              loving
            </p>
          </motion.div>
        </motion.div>

        {/* Product grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-5 lg:gap-7">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <BestSellerSkeleton key={i} />
              ))
            : products.map((item, i) => (
                <BestSellerCard key={item.id} item={item} index={i} />
              ))}
        </div>
      </div>
    </section>
  );
}

function BestSellerCard({
  item,
  index,
}: {
  item: ProductWithCategory;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.55,
        delay: index * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ scale: 1.04 }}
      style={{ transformOrigin: "bottom center" }}
    >
      <Link
        href={`/products/${item.slug}`}
        className="block group"
        aria-label={item.name}
      >
        {/* Image */}
        <div className="relative overflow-hidden aspect-[3/4] bg-stone">
          <Image
            src={item.image_url || "/placeholder.webp"}
            alt={item.name}
            fill
            className="object-cover object-center transition-transform duration-700 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
          {item.badge && (
            <span className="absolute top-3 left-3 px-2.5 py-1 bg-ink text-paper text-[9px] tracking-[0.18em] uppercase font-body">
              {item.badge}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="mt-3 space-y-0.5">
          <p
            className="text-ink truncate font-extrabold"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            {item.name}
          </p>
          <p
            className="text-ink"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              letterSpacing: "0.05em",
              fontWeight: "300",
            }}
          >
            {formatPrice(item.price)}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

function BestSellerSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[3/4] bg-stone" />
      <div className="mt-3 space-y-2">
        <div className="h-2 bg-stone w-3/4" />
        <div className="h-3 bg-stone w-1/3" />
      </div>
    </div>
  );
}
