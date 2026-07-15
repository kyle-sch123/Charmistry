/**
 * Bento-grid of category cards on the home page. Categories are fetched
 * client-side via the anon Supabase client and rendered in a fixed slot
 * order (necklaces / rings / earrings / bracelets / jewellery-boxes).
 */

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { getCategories } from "@/lib/queries";
import type { CategoryWithCount } from "@/types";

const SLUG_ORDER = [
  "necklaces",
  "rings",
  "earrings",
  "bracelets",
  "jewellery-boxes",
];

const AREA_CLASS: Record<string, string> = {
  necklaces: "cat-n",
  earrings: "cat-e",
  rings: "cat-r",
  bracelets: "cat-b",
  "jewellery-boxes": "cat-x",
};

export default function CategoriesGrid() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  const ordered = SLUG_ORDER.map((s) =>
    categories.find((c) => c.slug === s),
  ).filter(Boolean) as CategoryWithCount[];

  if (!ordered.length) return null;

  return (
    <section className="bg-paper py-0">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16">
        {/* Heading */}
        <motion.h2
          className="text-ink uppercase mb-8 md:mb-10"
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(1.8rem, 3.5vw, 3rem)",
            letterSpacing: "0.03em",
            lineHeight: 1.08,
          }}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          Shop by Category
        </motion.h2>

        {/* Bento grid */}
        <div className="cat-grid">
          {ordered.map((cat, i) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              areaClass={AREA_CLASS[cat.slug] ?? ""}
              index={i}
            />
          ))}
        </div>
      </div>

      <style>{`
        .cat-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1.7fr 1fr 1fr;
          grid-template-areas:
            "n n"
            "e r"
            "b x";
          height: 560px;
        }
        @media (min-width: 640px) {
          .cat-grid { height: 640px; }
        }
        @media (min-width: 1024px) {
          .cat-grid {
            grid-template-columns: 2fr 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            grid-template-areas:
              "n e r"
              "n b x";
            height: 620px;
          }
        }
        .cat-n { grid-area: n; }
        .cat-r { grid-area: r; }
        .cat-e { grid-area: e; }
        .cat-b { grid-area: b; }
        .cat-x { grid-area: x; }
      `}</style>
    </section>
  );
}

function CategoryCard({
  category,
  areaClass,
  index,
}: {
  category: CategoryWithCount;
  areaClass: string;
  index: number;
}) {
  return (
    <motion.div
      className={`relative overflow-hidden group cursor-pointer ${areaClass}`}
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.65,
        delay: 0.05 + index * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link
        href={`/shop?category=${category.slug}`}
        className="absolute inset-0 z-10"
        aria-label={`Shop ${category.name}`}
      />

      {/* Photo */}
      {category.image_url ? (
        <Image
          src={category.image_url}
          alt={category.name}
          fill
          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 40vw"
        />
      ) : (
        <div className="absolute inset-0 bg-ink/10" />
      )}

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-obsidian/65 via-obsidian/10 to-transparent transition-opacity duration-500 group-hover:from-obsidian/80" />

      {/* Pill label */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-5 z-[1]">
        <span
          className="px-5 py-[7px] border border-paper/75 text-paper backdrop-blur-[2px] transition-all duration-300 group-hover:border-paper group-hover:bg-paper/10"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "10.5px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          {category.name}
        </span>
      </div>
    </motion.div>
  );
}
