/**
 * The hour rail — the page's signature interaction.
 *
 * Desktop (lg+): a sticky "stage" on the left cross-fades between the five
 * editorial shots while the copy scrolls past on the right, tracked by a gold
 * progress line down a 18:00 → 23:00 gutter.
 *
 * Mobile: the stage is dropped entirely and each piece carries its own image
 * inline. A sticky pane plus a scrolling list on a 375px screen leaves ~40% of
 * the viewport for reading, and the photo↔piece pairing (the whole point of
 * the interaction) is lost the moment the two are separated. Stacked cards are
 * the honest mobile translation of the same idea, and they cost no JS.
 *
 * TWO SIZING RULES the stage has to respect, both learned the hard way:
 *
 *  1. It must clear the FIXED HEADER. Navbar is `fixed` and, on a solid
 *     (non-over-hero) page, contains the marquee *above* the nav row:
 *     36 + 64 = 100px on mobile, 40 + 80 = 120px from md. A sticky `top`
 *     smaller than that tucks the top of every photograph behind the navbar.
 *  2. It must FIT the remaining viewport, and show the whole frame. The five
 *     shots aren't one aspect ratio (0.63 → 0.75), so object-cover in a fixed
 *     box crops a different amount off each one. object-contain on a warm
 *     panel shows every photo whole, like a mat around a print.
 *
 * The two image sets share URLs and both carry loading="lazy", so the hidden
 * half never downloads: a display:none stage is never in the viewport, so the
 * lazy loader never resolves it. That's what keeps the phone from paying for
 * the desktop layout.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import AddEditButton from "@/components/product/AddEditButton";
import AffairImage from "./AffairImage";
import { formatPrice } from "@/lib/utils";
import type { AffairPiece } from "@/lib/daily-affair";
import type { ProductWithCategory } from "@/types";

export interface RailPiece extends AffairPiece {
  /** Catalogue row once it exists; null until the edit is seeded. */
  product: ProductWithCategory | null;
}

/** Fixed header (marquee + nav row) plus a little air. See rule 1 above. */
const STAGE_TOP = "9rem"; // 144px — 120px header + 24px breathing room
const STAGE_HEIGHT = `calc(100svh - ${STAGE_TOP} - 2rem)`;

export default function HourRail({ pieces }: { pieces: RailPiece[] }) {
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ["start center", "end center"],
  });
  const fill = useTransform(
    scrollYProgress,
    (v) => `${Math.min(100, Math.max(0, v * 100)).toFixed(1)}%`,
  );

  // Whichever piece owns the middle band of the viewport is the active one.
  useEffect(() => {
    const nodes =
      railRef.current?.querySelectorAll<HTMLElement>("[data-piece]");
    if (!nodes?.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActive(Number(e.target.getAttribute("data-piece")));
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid items-start gap-0 lg:grid-cols-[1fr_1fr] lg:gap-14 xl:gap-20">
      {/* ── the stage (desktop only) ── */}
      <div
        className="sticky hidden overflow-hidden bg-paper-warm lg:block"
        style={{ top: STAGE_TOP, height: STAGE_HEIGHT }}
      >
        {pieces.map((p, i) => (
          <figure
            key={p.slug}
            aria-hidden={i !== active}
            className="absolute inset-0 transition-opacity duration-[800ms] ease-[cubic-bezier(.2,.6,.2,1)]"
            style={{ opacity: i === active ? 1 : 0 }}
          >
            {/* object-contain: every frame shown whole — see rule 2. */}
            <AffairImage asset={p.stage} sizes="48vw" fit="contain" />
          </figure>
        ))}

        <p
          className="absolute bottom-4 left-1/2 -translate-x-1/2 uppercase text-ink/45"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "10px",
            letterSpacing: "0.3em",
          }}
          aria-live="polite"
        >
          {String(active + 1).padStart(2, "0")} / 0{pieces.length} —{" "}
          {pieces[active]?.name}
        </p>
      </div>

      {/* ── the hours ── */}
      <div ref={railRef} className="relative pl-6 sm:pl-14 lg:pl-16">
        {/* gutter, then the gold fill that tracks how far into the night you are */}
        <span
          aria-hidden
          className="absolute bottom-1.5 left-0 top-1.5 w-px bg-ink/12"
        />
        <motion.span
          aria-hidden
          className="absolute left-0 top-1.5 w-px bg-gold"
          style={{ height: reduce ? "100%" : fill }}
        />

        {pieces.map((piece, i) => {
          const on = i === active;
          const product = piece.product;
          const price = product ? Number(product.price) : piece.price;

          return (
            <article
              key={piece.slug}
              data-piece={i}
              className={`relative py-10 first:pt-0 md:py-12 lg:py-14 ${
                on ? "opacity-100" : "opacity-100 lg:opacity-45"
              } transition-opacity duration-700`}
            >
              {/*
                Tick + eyebrow.

                The dot always hangs on the rail. The hour label does not fit
                beside it on a phone: "18:00" at 11px/0.22em is ~40px wide and
                sits 14px past the rail, so it needs ~54px of gutter — more
                than a 375px screen can spare. At the old `pl-10` it simply ran
                over the eyebrow next to it.

                So on phones the hour reads as the first item of the eyebrow
                line, and the gutter carries only the dot. From sm, where the
                gutter is wide enough, it lifts back out beside the dot: the
                offsets below are the gutter width less the dot's advance and
                the gap (56 − 14 = 42px at sm, 64 − 14 = 50px at lg), which
                puts it exactly where the old flex tick did.
              */}
              <div className="relative mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  aria-hidden
                  className={`absolute -left-6 top-1/2 -ml-[3px] h-[7px] w-[7px] -translate-y-1/2 rounded-full transition-all duration-500 sm:-left-14 lg:-left-16 ${
                    on
                      ? "bg-gold shadow-[0_0_0_4px_rgba(201,168,76,.2)]"
                      : "bg-ink/25"
                  }`}
                />
                <span
                  className={`transition-colors duration-500 sm:absolute sm:top-1/2 sm:-left-[2.625rem] sm:-translate-y-1/2 lg:-left-[3.125rem] ${
                    on ? "text-gold-dark" : "text-ink/40"
                  }`}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "11px",
                    letterSpacing: "0.22em",
                  }}
                >
                  {piece.hour}
                </span>

                <p
                  className="uppercase text-ink/45"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "10px",
                    letterSpacing: "0.32em",
                  }}
                >
                  {piece.moment}
                </p>
              </div>

              <h3
                className="mb-4"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
                  lineHeight: 1.1,
                }}
              >
                {piece.name}
              </h3>

              {/* Mobile carries its own photograph — see the file header. */}
              <div className="relative mb-6 aspect-[3/4] overflow-hidden bg-paper-warm lg:hidden">
                <AffairImage asset={piece.stage} sizes="100vw" fit="contain" />
              </div>

              <p
                className="mb-5 max-w-[40ch] text-ink/65"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  lineHeight: 1.85,
                }}
              >
                {piece.copy}
              </p>

              <ul className="mb-6 flex flex-wrap gap-2">
                {piece.specs.map((s) => (
                  <li
                    key={s}
                    className="rounded-full border border-ink/12 px-3 py-1.5 text-ink/55"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "11px",
                    }}
                  >
                    {s}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "20px",
                  }}
                >
                  {formatPrice(price)}
                </span>

                <AddEditButton
                  products={product ? [product] : []}
                  label="Add to bag"
                  disabledLabel={product ? undefined : "Coming soon"}
                  tone="dark"
                  variant="outline"
                  fullWidth={false}
                />

                {product && (
                  <Link
                    href={`/products/${piece.slug}`}
                    className="inline-flex min-h-11 items-center border-b border-ink/15 uppercase text-ink/50 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "10px",
                      letterSpacing: "0.22em",
                    }}
                  >
                    Details
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
