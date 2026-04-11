"use client";

import { useEffect, useState } from "react";
import SectionHeading from "@/components/ui/SectionHeading";
import ProductCard from "@/components/ui/ProductCard";
import ScrollReveal from "@/components/ui/ScrollReveal";
import Button from "@/components/ui/Button";
import MagneticButton from "@/components/ui/MagneticButton";
import { getFeaturedProducts } from "@/lib/queries";
import type { ProductWithCategory } from "@/types";

export default function FeaturedProducts() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);

  useEffect(() => {
    getFeaturedProducts(8).then(setProducts);
  }, []);

  if (products.length < 8) return null;

  return (
    <section id="shop" className="py-24 md:py-36 px-6 md:px-8 max-w-7xl mx-auto">
      <SectionHeading
        eyebrow="Featured"
        title="Signature Pieces"
        subtitle="Our most coveted designs, chosen for their extraordinary craftsmanship and beauty."
      />

      {/* Asymmetric grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6">
        {/* Large featured item */}
        <ScrollReveal className="sm:col-span-2 lg:col-span-5 lg:row-span-2" delay={0}>
          <ProductCard product={products[0]} size="large" />
        </ScrollReveal>

        {/* Regular items */}
        <ScrollReveal className="lg:col-span-3" delay={0.1}>
          <ProductCard product={products[1]} />
        </ScrollReveal>
        <ScrollReveal className="lg:col-span-4" delay={0.15}>
          <ProductCard product={products[2]} />
        </ScrollReveal>
        <ScrollReveal className="lg:col-span-4" delay={0.2}>
          <ProductCard product={products[3]} />
        </ScrollReveal>
        <ScrollReveal className="lg:col-span-3" delay={0.25}>
          <ProductCard product={products[4]} />
        </ScrollReveal>

        {/* Second large item */}
        <ScrollReveal className="sm:col-span-2 lg:col-span-7 lg:row-span-2" delay={0.3}>
          <ProductCard product={products[7]} size="large" />
        </ScrollReveal>
        <ScrollReveal className="lg:col-span-5" delay={0.35}>
          <ProductCard product={products[5]} />
        </ScrollReveal>
        <ScrollReveal className="lg:col-span-5" delay={0.4}>
          <ProductCard product={products[6]} />
        </ScrollReveal>
      </div>

      <ScrollReveal className="flex justify-center mt-16 md:mt-20">
        <MagneticButton>
          <Button variant="outline" size="lg" href="#shop">
            View All Pieces
            <svg
              className="w-4 h-4"
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
          </Button>
        </MagneticButton>
      </ScrollReveal>
    </section>
  );
}
