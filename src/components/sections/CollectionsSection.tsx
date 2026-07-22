/**
 * Collections showcase on the home page — sits between the category bento grid
 * and the Shipping & Payments band.
 *
 * An interactive editorial "index" for the featured edit: a large preview frame
 * cross-fades between the five pieces as you hover / focus their row in a
 * numbered list. On touch / small screens (where hover doesn't exist) it
 * collapses to a stacked list of image cards, each linking to its product.
 *
 * Photography + slugs mirror src/app/collections/everyday — keep them in step
 * if the featured collection changes.
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { EVERYDAY_EDIT_BUNDLE } from "@/lib/bundles";

const BUCKET =
  "https://qkgakhluqruqoifknprg.supabase.co/storage/v1/object/public/Charmistry%20Assets";

const HREF = "/collections/everyday";

// Bundle pricing mirrors src/app/collections/everyday and the /collections index
// card — keep in step if the edit's price changes. The saving tracks the
// EVERYDAY_EDIT_BUNDLE discount so it can't drift from what the cart applies.
const REGULAR_TOTAL = 825;
const BUNDLE_PRICE = REGULAR_TOTAL - EVERYDAY_EDIT_BUNDLE.discountPerSet;

type Piece = {
  name: string;
  role: string;
  slug: string;
  image: string;
  alt: string;
};

const PIECES: Piece[] = [
  {
    name: "Lucy Necklace",
    role: "Chain necklace",
    slug: "lucy-necklaces-gold",
    image: `https://qkgakhluqruqoifknprg.supabase.co/storage/v1/object/public/Charmistry%20Assets/everyday-lucy-new.webp`,
    alt: "The Lucy gold chain layered with the Nova pendant",
  },
  {
    name: "Nova Necklace",
    role: "Pendant necklace",
    slug: "nova-necklaces-gold",
    image: `${BUCKET}/everyday-nova-lucy.webp`,
    alt: "Model wearing the Nova gold pendant necklace",
  },
  {
    name: "Sia Earrings",
    role: "Gold hoops",
    slug: "sia-earrings-gold",
    image: `${BUCKET}/everyday-nova.webp`,
    alt: "Close view of the Sia gold hoop earrings",
  },
  {
    name: "Sole Ring",
    role: "Stacking ring",
    slug: "sole-rings-gold",
    image: `${BUCKET}/everyday-sole-mila.webp`,
    alt: "The Sole gold ring worn with the Mila bangle",
  },
  {
    name: "Mila Bracelet",
    role: "Bangle bracelet",
    slug: "mila-bracelets-gold",
    image: `${BUCKET}/everyday-sole-mila.webp`,
    alt: "The Mila gold bangle bracelet on the wrist",
  },
];

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function CollectionsSection() {
  const [active, setActive] = useState(0);
  const total = String(PIECES.length).padStart(2, "0");

  return (
    <section className="bg-paper">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16">
        {/* ── Header ── */}
        <motion.div
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 md:mb-14"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div>
            <div className="flex items-center gap-4 mb-4">
              <span className="h-px w-10 bg-gold/50" />
              <span
                className="text-gold-dark"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                }}
              >
                Curated Edit · Year Round
              </span>
            </div>
            <h2
              className="text-ink leading-[0.95]"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(2.2rem, 5vw, 4rem)",
                letterSpacing: "0.02em",
              }}
            >
              The <em style={{ fontStyle: "italic" }}>Everyday</em> Edit
            </h2>
          </div>

          <div className="md:max-w-xs md:text-right">
            <p
              className="text-ink/50"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                letterSpacing: "0.06em",
                lineHeight: 1.7,
              }}
            >
              Five gold pieces made to be worn on repeat — layered into one
              effortless signature.
            </p>
          </div>
        </motion.div>

        {/* ── Interactive index ── */}
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-14 items-stretch">
          {/* Preview frame — desktop only (hover-driven) */}
          <motion.div
            className="hidden lg:block lg:order-2 relative lg:h-full min-h-[440px] overflow-hidden bg-stone"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            {PIECES.map((piece, i) => (
              <Image
                key={piece.slug}
                src={piece.image}
                alt={piece.alt}
                fill
                sizes="45vw"
                className={`object-cover object-[center_20%] transition-opacity duration-[700ms] ease-out ${
                  i === active ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}

            {/* Legibility gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/65 via-transparent to-ink/10 pointer-events-none" />

            {/* Running index */}
            <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
              <span
                className="text-ivory tabular-nums"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "20px",
                  letterSpacing: "0.05em",
                }}
              >
                {String(active + 1).padStart(2, "0")}
              </span>
              <span className="h-px w-6 bg-ivory/40" />
              <span
                className="text-ivory/60 tabular-nums"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "11px",
                  letterSpacing: "0.2em",
                }}
              >
                {total}
              </span>
            </div>

            {/* Active caption */}
            <div className="absolute bottom-0 left-0 right-0 p-7 z-10">
              <p
                className="text-gold-light mb-1.5 uppercase"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "9px",
                  letterSpacing: "0.28em",
                }}
              >
                {PIECES[active].role}
              </p>
              <p
                className="text-ivory leading-none"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "2rem",
                  fontWeight: 300,
                  letterSpacing: "0.01em",
                }}
              >
                {PIECES[active].name}
              </p>
            </div>
          </motion.div>

          {/* Numbered list */}
          <motion.ul
            className="lg:order-1 lg:border-t lg:border-ink/12"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
          >
            {PIECES.map((piece, i) => {
              const isActive = i === active;
              return (
                <li key={piece.slug} className="border-b border-ink/12">
                  <Link
                    href={`/products/${piece.slug}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className="group flex items-center gap-4 sm:gap-6 py-4 sm:py-6 outline-none cursor-pointer focus-visible:ring-1 focus-visible:ring-gold/60 focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
                  >
                    {/* Mobile thumbnail (hover-preview replaces this on desktop) */}
                    <div className="lg:hidden relative w-[64px] h-[80px] shrink-0 overflow-hidden bg-stone">
                      <Image
                        src={piece.image}
                        alt={piece.alt}
                        fill
                        sizes="64px"
                        className="object-cover object-[center_20%]"
                      />
                    </div>

                    {/* Index number */}
                    <span
                      className={`tabular-nums shrink-0 transition-colors duration-300 ${
                        isActive
                          ? "text-gold-dark"
                          : "text-ink/30 group-hover:text-ink/50"
                      }`}
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "11px",
                        letterSpacing: "0.2em",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    {/* Name + role */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`transition-all duration-300 group-hover:translate-x-1 ${
                          isActive ? "text-ink" : "text-ink/70"
                        }`}
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                          fontWeight: 300,
                          lineHeight: 1.1,
                          letterSpacing: "0.01em",
                        }}
                      >
                        {piece.name}
                      </p>
                      <p
                        className="mt-1 text-ink/40 uppercase"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "9.5px",
                          letterSpacing: "0.2em",
                        }}
                      >
                        {piece.role}
                      </p>
                    </div>

                    {/* Arrow */}
                    <svg
                      className={`w-4 h-4 shrink-0 transition-all duration-300 ${
                        isActive
                          ? "text-gold-dark opacity-100"
                          : "text-ink/40 opacity-0 group-hover:opacity-100"
                      } group-hover:translate-x-0.5`}
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
                  </Link>
                </li>
              );
            })}

            {/* CTA + bundle price */}
            <li className="pt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link
                href={HREF}
                className="group inline-flex items-center gap-2.5 border border-ink text-ink px-7 py-3.5 hover:bg-ink hover:text-paper transition-colors cursor-pointer"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                }}
              >
                Explore the Full Edit
                <svg
                  className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
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
              </Link>

              {/* Bundle price — beside the CTA */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-ink"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "1.6rem",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {formatPrice(BUNDLE_PRICE)}
                  </span>
                  <span
                    className="text-ink/35 line-through"
                    style={{ fontFamily: "var(--font-body)", fontSize: "12px" }}
                  >
                    {formatPrice(REGULAR_TOTAL)}
                  </span>
                </div>
                <p
                  className="mt-0.5 text-gold-dark uppercase"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "9.5px",
                    letterSpacing: "0.2em",
                  }}
                >
                  Bundle price · Save{" "}
                  {formatPrice(EVERYDAY_EDIT_BUNDLE.discountPerSet)}
                </p>
              </div>
            </li>
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
