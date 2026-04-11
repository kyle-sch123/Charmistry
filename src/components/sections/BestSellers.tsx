"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { formatPrice } from "@/lib/utils";
import { getInStockProducts } from "@/lib/queries";
import type { ProductWithCategory } from "@/types";

export default function BestSellers() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);

  useEffect(() => {
    getInStockProducts().then((data) => {
      // Pick a spread across categories — up to 5 items
      const seen = new Set<string>();
      const picks: ProductWithCategory[] = [];
      for (const p of data) {
        const key = p.name;
        if (!seen.has(key) && picks.length < 5) {
          seen.add(key);
          picks.push(p);
        }
      }
      setProducts(picks);
    });
  }, []);

  if (products.length === 0) return null;

  return (
    <section
      id="collection"
      className="bg-paper pt-14 md:pt-20 pb-6 md:pb-8 px-6 md:px-10 lg:px-16"
    >
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
        {products.map((item, i) => (
          <BestSellerCard key={item.id} item={item} index={i} />
        ))}
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
    <motion.a
      href="#"
      className="block cursor-pointer"
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
      {/* Image */}
      <div className="relative overflow-hidden aspect-[3/4]">
        <Image
          src={item.image_url || "/placeholder.webp"}
          alt={item.name}
          fill
          className="object-cover object-center"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />
      </div>

      {/* Info */}
      <div className="mt-3 space-y-0.5">
        <p
          className="text-ink truncate"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "10px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          {item.name}
        </p>
        <p
          className="text-ink font-semibold"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            letterSpacing: "0.05em",
          }}
        >
          {formatPrice(item.price)}
        </p>
      </div>
    </motion.a>
  );
}
