"use client";

import { CategoryWithCount } from "@/types";
import { motion } from "framer-motion";
import Image from "next/image";

interface CategoryCardProps {
  category: CategoryWithCount;
  index: number;
}

export default function CategoryCard({ category, index }: CategoryCardProps) {
  return (
    <motion.a
      href={`#${category.slug}`}
      className="group relative aspect-[3/4] overflow-hidden cursor-pointer block"
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {category.image_url ? (
        <Image
          src={category.image_url}
          alt={category.name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
      ) : (
        <div className="absolute inset-0 bg-charcoal" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute inset-0 border border-transparent group-hover:border-gold/30 transition-colors duration-500" />
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <span className="text-gold text-xs tracking-[0.2em] uppercase font-body mb-2 block">
          {category.product_count} Pieces
        </span>
        <h3 className="font-display text-2xl md:text-3xl text-ivory font-light">
          {category.name}
        </h3>
        <p className="text-smoke text-sm mt-1 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
          {category.description}
        </p>
      </div>
      <div className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 17L17 7M17 7H7M17 7v10" />
        </svg>
      </div>
    </motion.a>
  );
}
