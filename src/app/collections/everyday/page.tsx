/**
 * The Everyday Edit — a curated bundle collection page.
 *
 * Five gold pieces (Nova + Lucy necklaces, Kira hoops, Sole ring, Mila bangle)
 * sold individually or together as "the edit". Buying the edit applies the
 * CHARM-EDIT bundle code (a fixed R110 off, gated to the edit's subtotal) so the
 * five-piece total lands at a round bundle price — see AddEditButton +
 * CheckoutClient for how the code rides through to checkout.
 *
 * Server-rendered like /shop and /best-sellers: the five products are read from
 * the catalogue by slug so prices/stock stay live and the cart gets real rows.
 * Layout is deliberately its own editorial spread (hero → manifesto → image
 * triptych → shop-the-edit grid → bundle band) rather than the shop grid.
 */

import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/ui/ProductCard";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { getProductBySlug } from "@/lib/queries";
import { formatPrice } from "@/lib/utils";
import type { ProductWithCategory } from "@/types";
import AddEditButton from "./AddEditButton";

export const metadata: Metadata = {
  title: "The Everyday Edit | Charmistry",
  description:
    "Five gold pieces designed to be worn on repeat - the Nova and Lucy necklaces, Kira hoops, Sole ring and Mila bangle. Bought together as one edit for a bundle price.",
};

export const dynamic = "force-dynamic";

const BUCKET =
  "https://qkgakhluqruqoifknprg.supabase.co/storage/v1/object/public/Charmistry%20Assets";

const IMG = {
  heroNovaLucy: `${BUCKET}/everyday-nova-lucy.webp`,
  earring: `${BUCKET}/everyday-earring.webp`,
  nova: `${BUCKET}/everyday-nova.webp`,
  soleMila: `${BUCKET}/everyday-sole-mila.webp`,
};

/** Kept in step with EVERYDAY_EDIT_BUNDLE.discountPerSet in lib/bundles.ts. */
const BUNDLE_SAVINGS = 110;

// Ordered pieces of the edit. Slugs point at the gold variants — the edit is
// styled entirely in gold across all four editorial shots.
const EDIT = [
  { slug: "nova-necklaces-gold", label: "Nova", role: "Pendant necklace" },
  { slug: "lucy-necklaces-gold", label: "Lucy", role: "Chain necklace" },
  { slug: "sia-earrings-gold", label: "Sia", role: "Earrings" },
  { slug: "sole-rings-gold", label: "Sole", role: "Stacking ring" },
  { slug: "mila-bracelets-gold", label: "Mila", role: "Bangle bracelet" },
] as const;

const GALLERY = [
  {
    src: IMG.heroNovaLucy,
    alt: "Model wearing the Lucy and Nova Necklaces",
    piece: "Lucy & Nova",
    caption: "The perfect layer",
  },
  {
    src: IMG.soleMila,
    alt: "Hands wearing the Sole gold ring and the Mila gold bangle",
    piece: "Sole & Mila",
    caption: "For hands, quietly",
  },
  {
    src: IMG.nova,
    alt: "Close view of the Nova gold pendant necklace",
    piece: "Sia",
    caption: "The pair you’ll reach for every day",
  },
];

export default async function EverydayEditPage() {
  const fetched = await Promise.all(EDIT.map((e) => getProductBySlug(e.slug)));
  const pieces = EDIT.map((e, i) => ({ ...e, product: fetched[i] })).filter(
    (p): p is (typeof EDIT)[number] & { product: ProductWithCategory } =>
      p.product != null,
  );
  const products = pieces.map((p) => p.product);

  const regularTotal = products.reduce((sum, p) => sum + Number(p.price), 0);
  const bundlePrice = regularTotal - BUNDLE_SAVINGS;

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper text-ink">
        {/* ── Hero ── */}
        <section className="relative grid lg:grid-cols-[1.05fr_0.95fr] lg:min-h-screen">
          {/* Editorial copy */}
          <div className="order-2 lg:order-1 flex flex-col justify-center px-6 md:px-12 lg:px-16 pt-16 pb-20 lg:py-32">
            <div className="max-w-lg">
              <Link
                href="/collections"
                className="inline-flex items-center gap-2 text-ink/40 hover:text-ink transition-colors mb-8 group"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                }}
              >
                <span className="w-6 h-px bg-current transition-all duration-300 group-hover:w-9" />
                All Collections
              </Link>

              <p
                className="text-gold-dark mb-5"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.35em",
                  textTransform: "uppercase",
                }}
              >
                Curated Edit · Year Round
              </p>

              <h1
                className="text-ink leading-[0.92]"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "clamp(2.8rem, 6.5vw, 5.5rem)",
                  letterSpacing: "0.01em",
                }}
              >
                The <em style={{ fontStyle: "italic" }}>Everyday</em>
                <br />
                Edit
              </h1>

              <p
                className="mt-7 text-ink/55 max-w-md"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  letterSpacing: "0.03em",
                  lineHeight: 1.8,
                }}
              >
                Five gold pieces made to be worn on repeat - a pendant, a chain,
                a pair of hoops, a ring and a bangle that layer into a single,
                effortless signature. Bought together, they become the edit.
              </p>

              {/* Price + primary action */}
              <div className="mt-9 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-heading text-4xl text-ink">
                  {formatPrice(bundlePrice)}
                </span>
                <span className="font-body text-sm text-ink/35 line-through">
                  {formatPrice(regularTotal)}
                </span>
                <span
                  className="text-gold-dark"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "10px",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                  }}
                >
                  Save {formatPrice(BUNDLE_SAVINGS)}
                </span>
              </div>

              <div className="mt-6 max-w-sm">
                <AddEditButton
                  products={products}
                  label={`Add the Edit - ${formatPrice(bundlePrice)}`}
                  showNote
                />
              </div>

              <Link
                href="#pieces"
                className="mt-6 inline-flex items-center gap-2 text-ink/50 hover:text-ink transition-colors"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                }}
              >
                Or shop the pieces individually
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </Link>
            </div>
          </div>

          {/* Hero image */}
          <div className="order-1 lg:order-2 relative h-[62vh] min-h-[380px] lg:h-auto bg-stone overflow-hidden">
            <Image
              src={IMG.heroNovaLucy}
              alt="Model wearing the layered Nova and Lucy gold necklaces from the Everyday Edit"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 48vw"
              className="object-cover object-[center_20%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/15 via-transparent to-transparent lg:bg-gradient-to-r lg:from-paper/20 lg:via-transparent lg:to-transparent" />
          </div>
        </section>

        {/* ── Manifesto strip ── */}
        <section className="border-y border-ink/10 bg-paper-warm">
          <div className="max-w-4xl mx-auto px-6 py-16 md:py-20 text-center">
            <ScrollReveal>
              <div className="flex items-center justify-center gap-4 mb-6">
                <span className="w-10 h-px bg-gold/50" />
                <span
                  className="text-gold-dark"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "10px",
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                  }}
                >
                  The Edit
                </span>
                <span className="w-10 h-px bg-gold/50" />
              </div>
              <p
                className="text-ink/80 mx-auto max-w-2xl"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.4rem, 3vw, 2.1rem)",
                  lineHeight: 1.5,
                  fontWeight: 300,
                }}
              >
                Not a special occasion. Just the pieces you reach for from
                Monday morning to Sunday afternoon.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Editorial triptych ── */}
        <section className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-20 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {GALLERY.map((shot, i) => (
              <ScrollReveal
                key={shot.piece}
                delay={i * 0.12}
                className={i === 1 ? "md:mt-16" : i === 2 ? "md:mt-8" : ""}
              >
                <figure className="group">
                  <div className="relative aspect-[4/5] overflow-hidden bg-stone">
                    <Image
                      src={shot.src}
                      alt={shot.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105"
                    />
                  </div>
                  <figcaption className="mt-4 flex items-baseline justify-between">
                    <span className="font-display text-lg text-ink">
                      {shot.piece}
                    </span>
                    <span
                      className="text-ink/45"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "10px",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                      }}
                    >
                      {shot.caption}
                    </span>
                  </figcaption>
                </figure>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ── Shop the edit ── */}
        <section
          id="pieces"
          className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pb-8 scroll-mt-28"
        >
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-8 border-b border-ink/10">
            <div>
              <p
                className="text-ink/40 mb-3"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.35em",
                  textTransform: "uppercase",
                }}
              >
                Five Pieces
              </p>
              <h2
                className="text-ink uppercase leading-[0.95]"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "clamp(2rem, 4.5vw, 3.4rem)",
                  letterSpacing: "0.02em",
                }}
              >
                Shop the Edit
              </h2>
            </div>
            <p
              className="text-ink/50 max-w-xs lg:text-right pb-1"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                letterSpacing: "0.06em",
                lineHeight: 1.7,
              }}
            >
              Take the whole edit, or start with the one that speaks to you.
              Every piece is water &amp; tarnish resistant.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 lg:grid-cols-5 gap-x-5 gap-y-10 md:gap-x-7">
            {pieces.map(({ product, label, role }) => (
              <div key={product.id} className="flex flex-col">
                {/* Reserve a uniform two-line height on the narrow 2-col mobile
                    grid so labels that wrap differently ("Lucy · Chain necklace"
                    vs a shorter role) don't push their card out of alignment
                    with the row. From md the columns are wide enough for one
                    line, so the reservation is released. */}
                <p
                  className="mb-2 text-gold-dark leading-[1.4] line-clamp-2 min-h-[2.8em] md:min-h-0"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "9px",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                  }}
                >
                  {label} · {role}
                </p>
                <ProductCard product={product} variant="light" />
              </div>
            ))}
          </div>
        </section>

        {/* ── Bundle offer ── */}
        <section
          id="bundle"
          className="mt-20 md:mt-28 bg-paper-warm border-t border-ink/10 scroll-mt-28"
        >
          <div className="max-w-5xl mx-auto px-6 md:px-10 py-20 md:py-28">
            {/* Header */}
            <ScrollReveal className="text-center mb-12 md:mb-14">
              <div className="flex items-center justify-center gap-4 mb-5">
                <span className="w-10 h-px bg-gold/50" />
                <span
                  className="text-gold-dark"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "10px",
                    letterSpacing: "0.35em",
                    textTransform: "uppercase",
                  }}
                >
                  Complete the Edit
                </span>
                <span className="w-10 h-px bg-gold/50" />
              </div>
              <h2
                className="text-ink leading-[0.95]"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "clamp(2.2rem, 5vw, 3.6rem)",
                  letterSpacing: "0.01em",
                }}
              >
                Five pieces, <em style={{ fontStyle: "italic" }}>one</em> edit.
              </h2>
              <p
                className="mt-5 mx-auto max-w-md text-ink/55"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "13.5px",
                  letterSpacing: "0.03em",
                  lineHeight: 1.8,
                }}
              >
                Add all five to your bag and the bundle price applies
                automatically - {formatPrice(BUNDLE_SAVINGS)} off.
              </p>
            </ScrollReveal>

            {/* Offer card */}
            <ScrollReveal delay={0.05}>
              <div className="relative bg-paper border border-ink/12 shadow-[0_28px_70px_-40px_rgba(10,10,10,0.35)] grid md:grid-cols-[1.15fr_1fr]">
                {/* Gold corner accents */}
                <span className="absolute -top-px -left-px w-9 h-9 border-t border-l border-gold/60 pointer-events-none" />
                <span className="absolute -bottom-px -right-px w-9 h-9 border-b border-r border-gold/60 pointer-events-none" />

                {/* Itemised receipt */}
                <div className="p-8 md:p-10">
                  <p
                    className="text-ink/40 mb-5"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "10px",
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                    }}
                  >
                    What&apos;s inside
                  </p>
                  <ul>
                    {pieces.map(({ product, label, role }) => (
                      <li
                        key={product.id}
                        className="flex items-baseline gap-3 py-2.5"
                      >
                        <span className="flex items-baseline gap-2 shrink-0">
                          <span className="font-display text-[17px] text-ink">
                            {label}
                          </span>
                          <span
                            className="text-ink/40"
                            style={{
                              fontFamily: "var(--font-body)",
                              fontSize: "10px",
                              letterSpacing: "0.14em",
                              textTransform: "uppercase",
                            }}
                          >
                            {role}
                          </span>
                        </span>
                        <span
                          className="flex-1 border-b border-dotted border-ink/25 -translate-y-[3px]"
                          aria-hidden
                        />
                        <span className="shrink-0 font-body text-sm text-ink/70 tabular-nums">
                          {formatPrice(Number(product.price))}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 pt-4 border-t border-ink/10 flex items-baseline justify-between">
                    <span
                      className="text-ink/45"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "10px",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                      }}
                    >
                      Bought separately
                    </span>
                    <span className="font-body text-sm text-ink/45 line-through tabular-nums">
                      {formatPrice(regularTotal)}
                    </span>
                  </div>
                </div>

                {/* Price panel */}
                <div className="p-8 md:p-10 bg-paper-warm border-t md:border-t-0 md:border-l border-ink/10 flex flex-col justify-center">
                  <p
                    className="text-gold-dark"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "10px",
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                    }}
                  >
                    Bundle price
                  </p>

                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="font-heading text-5xl md:text-6xl text-ink leading-none">
                      {formatPrice(bundlePrice)}
                    </span>
                    <span className="font-body text-base text-ink/35 line-through">
                      {formatPrice(regularTotal)}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <span
                      className="inline-flex items-center border border-gold/50 text-gold-dark px-3 py-1.5"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "10px",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                      }}
                    >
                      Save {formatPrice(BUNDLE_SAVINGS)}
                    </span>
                  </div>

                  <div className="mt-8">
                    <AddEditButton
                      products={products}
                      label={`Add the Edit - ${formatPrice(bundlePrice)}`}
                      showNote
                    />
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
