"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import TextReveal from "@/components/ui/TextReveal";
import { getCategories } from "@/lib/queries";
import type { CategoryWithCount } from "@/types";

export default function CategoryShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0.05, 0.95], ["0%", "-60%"]);

  const [categories, setCategories] = useState<CategoryWithCount[]>([]);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  if (categories.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      id="collection"
      className="relative h-[300vh]"
    >
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        {/* Section header */}
        <div className="px-6 md:px-8 max-w-7xl mx-auto w-full mb-8 md:mb-12">
          <motion.div
            className="flex items-center gap-4 mb-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div className="h-px w-12 bg-gold" />
            <span className="text-gold text-xs tracking-[0.3em] uppercase font-body font-medium">
              Collections
            </span>
          </motion.div>
          <h2 className="font-display text-4xl md:text-6xl lg:text-7xl font-light text-ivory">
            <TextReveal text="Curated for You" staggerChildren={0.04} />
          </h2>
        </div>

        {/* Horizontal scrolling track */}
        <motion.div className="flex gap-6 md:gap-8 pl-6 md:pl-8" style={{ x }}>
          {categories.map((category, index) => (
            <CategorySlide key={category.id} category={category} index={index} />
          ))}
          {/* Extra CTA slide */}
          <div className="flex-shrink-0 w-[70vw] md:w-[40vw] lg:w-[30vw] flex items-center justify-center">
            <motion.a
              href="#shop"
              className="group flex flex-col items-center gap-6 cursor-pointer"
              whileHover="hover"
            >
              <motion.div
                className="w-20 h-20 rounded-full border border-gold/40 flex items-center justify-center"
                variants={{
                  hover: {
                    scale: 1.1,
                    borderColor: "rgba(201, 168, 76, 0.8)",
                  },
                }}
                transition={{ duration: 0.3 }}
              >
                <svg
                  className="w-6 h-6 text-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </motion.div>
              <span className="text-ivory font-display text-2xl font-light">
                View All
              </span>
            </motion.a>
          </div>
        </motion.div>

        {/* Scroll progress bar */}
        <div className="px-6 md:px-8 max-w-7xl mx-auto w-full mt-8 md:mt-12">
          <div className="h-px bg-graphite/50 relative overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gold"
              style={{ scaleX: scrollYProgress, transformOrigin: "left" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function CategorySlide({
  category,
  index,
}: {
  category: CategoryWithCount;
  index: number;
}) {
  return (
    <motion.a
      href={`#${category.slug}`}
      className="group relative flex-shrink-0 w-[80vw] md:w-[45vw] lg:w-[30vw] aspect-[3/4] overflow-hidden cursor-pointer block"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, delay: index * 0.1 }}
    >
      {category.image_url ? (
        <Image
          src={category.image_url}
          alt={category.name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          sizes="(max-width: 768px) 80vw, (max-width: 1024px) 45vw, 30vw"
        />
      ) : (
        <div className="absolute inset-0 bg-charcoal" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Gold border on hover */}
      <div className="absolute inset-0 border border-transparent group-hover:border-gold/30 transition-colors duration-500" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-8">
        <span className="text-gold text-xs tracking-[0.2em] uppercase font-body mb-2 block">
          {category.product_count} Pieces
        </span>
        <h3 className="font-display text-3xl md:text-4xl text-ivory font-light mb-2">
          {category.name}
        </h3>
        <p className="text-smoke text-sm opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
          {category.description}
        </p>
      </div>

      {/* Corner arrow */}
      <div className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <svg
          className="w-5 h-5 text-gold"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 17L17 7M17 7H7M17 7v10"
          />
        </svg>
      </div>
    </motion.a>
  );
}
