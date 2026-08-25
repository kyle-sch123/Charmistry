/**
 * The Daily Affair — the evening counterpart to the Everyday Edit.
 *
 * Art direction: the site's own paper/ink/gold system, in a slightly quieter
 * register than the Everyday Edit. The evening lives in the *photography* and
 * in the 18:00 → 23:00 hour rail, not in the page's chrome — an earlier pass
 * put the whole page on a warm black and it read as a different website.
 *
 * Layout follows the site's standard: solid <Navbar /> (which carries the
 * marquee itself, above the nav row, exactly as on every other page), then
 * paper sections with hairline rules.
 *
 * DATA: the edit's pieces are read from the catalogue by slug so prices and
 * stock stay live and the cart gets real rows. Until the rows exist (see
 * scripts/seed-daily-affair.mjs) getProductBySlug returns null and the page
 * degrades honestly — full copy and photography, band prices for display, and
 * every buy action reading "Coming soon" rather than silently vanishing the
 * piece the way the Everyday Edit's filter would.
 *
 * LAUNCH: set DAILY_AFFAIR_LIVE in lib/daily-affair.ts. That one flag drives
 * this route, the /collections card and the Collections nav entry — false
 * takes the collection off the site, true is public.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AddEditButton from "@/components/product/AddEditButton";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { getProductBySlug } from "@/lib/queries";
import { formatPrice } from "@/lib/utils";
import {
  DAILY_AFFAIR_LIVE,
  DAILY_AFFAIR_PIECES,
  DAILY_AFFAIR_SAVINGS,
  DAILY_AFFAIR_SILVER,
  IMG,
  affairFallbackSrc,
  affairSrcSet,
} from "@/lib/daily-affair";
import type { ProductWithCategory } from "@/types";
import AffairImage from "./AffairImage";
import HourRail, { type RailPiece } from "./HourRail";

export const metadata: Metadata = {
  title: "The Daily Affair | Charmistry",
  description:
    "Five pieces that go from your desk to the last drink without a single change. The Daily Affair — an evening edit of waterproof, tarnish-resistant Charmistry jewellery.",
  openGraph: {
    title: "The Daily Affair | Charmistry",
    description:
      "Five pieces that go from your desk to the last drink without a single change.",
    images: [affairFallbackSrc(IMG.campaignWide)],
  },
};

export const dynamic = "force-dynamic";

const PROMISE = [
  {
    h: "Wear it in",
    b: "Shower, sea, the last drink. It stays gold — and if it doesn't within six months, the Charmistry Guarantee replaces it.",
  },
  {
    h: "Stainless steel",
    b: "The same steel as everything else we make: waterproof, tarnish-resistant, and kind to skin that usually reacts.",
  },
  {
    h: "Changed your mind?",
    b: "Seven days from delivery to exchange it or take store credit. Exchanges are free.",
  },
  {
    h: "2–5 business days",
    b: "Tracked, nationwide. Free on this edit — it clears the R700 threshold on its own.",
  },
];

export default async function DailyAffairPage() {
  // The single switch that can take the collection back off the site.
  if (!DAILY_AFFAIR_LIVE) notFound();

  // A catalogue miss must never take the page down — an unseeded slug simply
  // resolves to null and that piece renders from its static copy.
  const fetched = await Promise.all(
    DAILY_AFFAIR_PIECES.map((p) => getProductBySlug(p.slug).catch(() => null)),
  );

  const pieces: RailPiece[] = DAILY_AFFAIR_PIECES.map((p, i) => ({
    ...p,
    product: fetched[i],
  }));

  const products = fetched.filter((p): p is ProductWithCategory => p != null);
  const editComplete = products.length === DAILY_AFFAIR_PIECES.length;

  // Live prices win; band prices stand in per-piece until a row exists.
  const listPrice = pieces.reduce(
    (sum, p) => sum + (p.product ? Number(p.product.price) : p.price),
    0,
  );
  const bundlePrice = listPrice - DAILY_AFFAIR_SAVINGS;

  return (
    <>
      <Navbar />

      <main className="flex-1 bg-paper text-ink">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        {/*
          Fills the viewport exactly, so the next section never peeks in under
          it. Not a plain 100svh: Navbar renders an in-flow spacer the height of
          the marquee (h-9 / md:h-10) above this section, so a full 100svh would
          overshoot by that much and push the fold below the screen. The nav row
          itself is `fixed` and takes no flow space — the pt-32 below is what
          keeps the type clear of it.
        */}
        <section className="relative isolate flex min-h-[calc(100svh-2.25rem)] items-end overflow-hidden md:min-h-[calc(100svh-2.5rem)]">
          {/* The evening lives in the photograph, not in the page. */}
          <div className="absolute inset-0 -z-10 bg-stone">
            <picture>
              <source
                media="(min-width: 768px)"
                srcSet={affairSrcSet(IMG.campaignWide)}
                sizes="100vw"
              />
              <img
                src={affairFallbackSrc(IMG.campaignTall)}
                srcSet={affairSrcSet(IMG.campaignTall)}
                sizes="100vw"
                alt={IMG.campaignTall.alt}
                width={IMG.campaignTall.w}
                height={IMG.campaignTall.h}
                loading="eager"
                fetchPriority="high"
                decoding="sync"
                // A 3:4 source in a wide band shows only ~a third of its height,
                // so the focal point matters: 42% lands on the collarbone (the
                // jewellery) rather than on her face.
                className="h-full w-full object-cover object-[center_42%] brightness-[.62] saturate-[.85]"
              />
            </picture>
            {/* Scrim only where the type sits, so the photo stays a photo. */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(10,10,10,.82) 0%, rgba(10,10,10,.45) 38%, rgba(10,10,10,.08) 70%, transparent 100%)",
              }}
            />
          </div>

          <div className="mx-auto w-full max-w-7xl px-6 pb-12 pt-32 md:px-10 md:pb-16 lg:px-16">
            <div className="mb-5 flex items-center gap-4">
              <span className="h-px w-10 bg-gold" aria-hidden />
              <p
                className="uppercase text-paper/70"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.35em",
                }}
              >
                After six · A Charmistry edit
              </p>
            </div>

            {/*
              No opacity ramp on the headline, ever. Chrome scores an element
              for LCP only on its first paint — painted at opacity 0 it is
              skipped and never re-qualifies. See the home hero.
            */}
            <h1
              className="text-paper"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(2.9rem, 9vw, 6.5rem)",
                lineHeight: 0.9,
                letterSpacing: "0.01em",
              }}
            >
              The Daily{" "}
              <em className="text-gold-light" style={{ fontStyle: "italic" }}>
                Affair
              </em>
            </h1>

            <p
              className="mt-6 max-w-[38ch] text-paper/75"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                letterSpacing: "0.02em",
                lineHeight: 1.8,
              }}
            >
              Five pieces that go from your desk to the last drink without a
              single change.{" "}
              <span className="text-paper">
                Still waterproof. Still tarnish-resistant.
              </span>{" "}
              Just dressed for somewhere better.
            </p>
          </div>
        </section>

        {/* ── The hour rail ────────────────────────────────────────────── */}
        <section className="py-16 md:py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
            <div className="mb-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-b border-ink/10 pb-6 md:mb-16">
              <h2
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "clamp(1.6rem, 3.4vw, 2.6rem)",
                  lineHeight: 1.15,
                }}
              >
                One night, five pieces
              </h2>
              <p
                className="uppercase text-ink/45"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "11px",
                  letterSpacing: "0.28em",
                }}
              >
                18:00 — 23:00
              </p>
            </div>

            <HourRail pieces={pieces} />
          </div>
        </section>

        {/* ── Editorial break ──────────────────────────────────────────── */}
        <section className="border-t border-ink/10 bg-paper-warm">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-16 md:px-10 md:py-24 lg:px-16">
            <ScrollReveal>
              <div className="relative aspect-[3/4] overflow-hidden bg-stone">
                <AffairImage
                  asset={IMG.tableWorn}
                  sizes="(max-width: 767px) 100vw, 45vw"
                />
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <p
                className="uppercase text-ink/45"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.35em",
                }}
              >
                Why an evening edit
              </p>
              <blockquote
                className="mt-5"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.6rem, 4vw, 2.5rem)",
                  fontStyle: "italic",
                  lineHeight: 1.25,
                }}
              >
                “Nobody goes home to change any more. The jewellery has to do it
                for you.”
              </blockquote>
              <p
                className="mt-6 max-w-[44ch] text-ink/65"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  lineHeight: 1.85,
                }}
              >
                So the brief was narrow: stones, but small ones. Chain that
                catches light without announcing itself. Nothing that needs
                taking off before a shower, a swim, or the walk home in the
                rain. Dressier, in other words — never more careful.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ── The Full Affair ──────────────────────────────────────────── */}
        <section className="border-t border-ink/10 py-16 md:py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
            <div className="mb-9 flex flex-wrap items-end justify-between gap-x-10 gap-y-7">
              <div>
                <p
                  className="uppercase text-gold-dark"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "10px",
                    letterSpacing: "0.35em",
                  }}
                >
                  All five · Save {formatPrice(DAILY_AFFAIR_SAVINGS)}
                </p>
                <h2
                  className="my-4"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "clamp(2rem, 5vw, 4rem)",
                    lineHeight: 1,
                  }}
                >
                  The Full Affair
                </h2>
                <p
                  className="max-w-[46ch] text-ink/65"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "14px",
                    lineHeight: 1.85,
                  }}
                >
                  Buy the edit and all five arrive together, layered in the
                  order they&rsquo;re meant to be worn. It clears the free
                  delivery threshold on its own, and every piece is covered for
                  six months.
                </p>
              </div>

              <div className="sm:text-right">
                <p className="font-body text-sm text-ink/35 line-through">
                  {formatPrice(listPrice)}
                </p>
                <p
                  className="my-1.5"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "clamp(2rem, 5vw, 3.4rem)",
                    lineHeight: 1,
                  }}
                >
                  {formatPrice(bundlePrice)}
                </p>
                <p
                  className="uppercase text-gold-dark"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "10px",
                    letterSpacing: "0.22em",
                  }}
                >
                  You save {formatPrice(DAILY_AFFAIR_SAVINGS)}
                </p>
              </div>
            </div>

            {/* The five, as clean cut-outs. Scroll-snap strip on phones so each
                piece stays big enough to read; a 5-up grid from sm. */}
            <ul className="mb-8 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-5 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
              {pieces.map((p) => {
                const inner = (
                  <>
                    <AffairImage
                      asset={p.cutout}
                      sizes="(max-width: 639px) 42vw, 18vw"
                      className="transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  </>
                );

                return (
                  <li
                    key={p.slug}
                    className="min-w-[42vw] shrink-0 snap-start sm:min-w-0"
                  >
                    {p.product ? (
                      <Link
                        href={`/products/${p.slug}`}
                        className="group relative block aspect-[3/4] overflow-hidden bg-paper-warm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="group relative block aspect-[3/4] overflow-hidden bg-paper-warm">
                        {inner}
                      </div>
                    )}
                    <p
                      className="mt-2.5 uppercase text-ink/55"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "10px",
                        letterSpacing: "0.2em",
                      }}
                    >
                      {p.short}
                    </p>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <AddEditButton
                products={editComplete ? products : []}
                label={`Add all five — ${formatPrice(bundlePrice)}`}
                disabledLabel={editComplete ? undefined : "Coming soon"}
                tone="dark"
                variant="solid"
                fullWidth={false}
              />
              <Link
                href="/shop"
                className="inline-flex min-h-11 items-center border-b border-ink/15 uppercase text-ink/50 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.22em",
                }}
              >
                Or build your own stack
              </Link>
            </div>

            {editComplete && (
              <p
                className="mt-4 uppercase text-ink/45"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                }}
              >
                Bundle price applied automatically at checkout
              </p>
            )}
          </div>
        </section>

        {/* ── The same night, in silver ────────────────────────────────── */}
        <section className="border-t border-ink/10 bg-paper-warm py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
            {/*
              `grid-cols-1` is load-bearing, not decoration. Without an
              explicit base track the single implicit column is auto-sized,
              and an auto track takes the max-content width of its widest
              item — here the silver strip below, whose five `min-w-[38vw]`
              cards measure ~780px. That blew the column out to 780px on a
              390px phone: the strip stopped scrolling, and the portrait
              beside it inherited the same width and stood 1041px tall,
              taller than the viewport, clipped by the body's overflow guard.
              minmax(0,…) on the lg tracks fences off the same failure there.
            */}
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16">
              <ScrollReveal>
                <div className="relative aspect-[3/4] overflow-hidden bg-stone">
                  <AffairImage
                    asset={IMG.luneWorn}
                    sizes="(max-width: 1023px) 100vw, 38vw"
                  />
                </div>
              </ScrollReveal>

              <div>
                <p
                  className="uppercase text-ink/45"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "10px",
                    letterSpacing: "0.35em",
                  }}
                >
                  The other half of the collection
                </p>
                <h2
                  className="my-4"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "clamp(1.7rem, 4vw, 3rem)",
                    lineHeight: 1.1,
                  }}
                >
                  The same night, in silver
                </h2>
                <p
                  className="max-w-[46ch] text-ink/65"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "14px",
                    lineHeight: 1.85,
                  }}
                >
                  Every piece in the edit is made in silver too — and the Lune,
                  a twisted band set with a line of small stones, is silver
                  only. Wear it where the Astra would go.
                </p>

                <ul className="mt-8 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-5 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
                  {DAILY_AFFAIR_SILVER.map((s) => (
                    <li
                      key={s.image.stem}
                      className="min-w-[38vw] shrink-0 snap-start sm:min-w-0"
                    >
                      <div className="relative aspect-square overflow-hidden bg-paper">
                        <AffairImage
                          asset={s.image}
                          sizes="(max-width: 639px) 38vw, 15vw"
                        />
                      </div>
                      <p
                        className="mt-2.5 uppercase text-ink/70"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "10px",
                          letterSpacing: "0.16em",
                        }}
                      >
                        {s.name}
                      </p>
                      <p
                        className="text-ink/45"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "10px",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {s.note}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── The fine print ───────────────────────────────────────────── */}
        <section className="border-t border-ink/10 py-14 pb-20 md:py-20 md:pb-28">
          <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
            <p
              className="uppercase text-ink/45"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "10px",
                letterSpacing: "0.35em",
              }}
            >
              The fine print, which is short
            </p>
            <p
              className="mt-4 max-w-[48ch] text-ink/65"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                lineHeight: 1.85,
              }}
            >
              Dressier doesn&rsquo;t mean more careful. Everything in this edit
              is the same steel as the rest of Charmistry — it just looks better
              at night.
            </p>

            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-10">
              {PROMISE.map((p) => (
                <div key={p.h}>
                  <h3
                    className="mb-2"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "19px",
                    }}
                  >
                    {p.h}
                  </h3>
                  <p
                    className="text-ink/65"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "13.5px",
                      lineHeight: 1.75,
                    }}
                  >
                    {p.b}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/collections"
              className="group mt-12 inline-flex min-h-11 items-center gap-2 uppercase text-ink/50 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "10px",
                letterSpacing: "0.28em",
              }}
            >
              <span
                className="h-px w-6 bg-current transition-all duration-300 group-hover:w-9"
                aria-hidden
              />
              All Collections
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
