/**
 * The Daily Affair — collection page, currently in "reveal" dress.
 *
 * PLACEHOLDERS: Kyle's campaign photography hasn't landed yet, so every image
 * slot renders a <PlaceholderFrame> (stone field, hairline crosshatch, quiet
 * caption). Swapping in the real photos = replacing each PlaceholderFrame
 * with an <Image> — the layout, copy and rhythm are final. The pieces grid is
 * likewise a numbered teaser until the collection's line-up is confirmed.
 *
 * Art direction: the evening counterpart to the Everyday Edit — ink-dark
 * hero, gilded hairlines, big italic serif. Same tokens (paper/ink/gold),
 * moodier register.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ScrollReveal from "@/components/ui/ScrollReveal";

// Launch gate — the page is fully built but Kyle doesn't want it reachable
// before the campaign photos land. Flip to true (and restore the /collections
// card link + collections nav entry, see navigation.ts) to launch.
const COLLECTION_LIVE = false;

export const metadata: Metadata = {
  title: "The Daily Affair | Charmistry",
  description:
    "The Daily Affair — a new Charmistry collection for the hours between morning coffee and last light. Full reveal coming soon.",
};

/** Image slot awaiting campaign photography. */
function PlaceholderFrame({
  label = "Photography coming soon",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-stone ${className}`}
      role="img"
      aria-label={label}
    >
      {/* Hairline crosshatch so the empty frame reads as intentional */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent 0 14px, rgba(10,10,10,0.05) 14px 15px)",
        }}
        aria-hidden
      />
      <div className="absolute inset-3 border border-ink/10" aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="uppercase text-ink/30 text-center px-6"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "9px",
            letterSpacing: "0.32em",
            lineHeight: 2,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

const TEASER_PIECES = [
  { num: "01", role: "The pendant" },
  { num: "02", role: "The chain" },
  { num: "03", role: "The hoops" },
  { num: "04", role: "The bangle" },
];

export default function DailyAffairPage() {
  if (!COLLECTION_LIVE) notFound();
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper text-ink">
        {/* ── Hero — ink band ── */}
        <section className="relative bg-ink text-paper overflow-hidden">
          {/* Faint gold radial glow, upper right */}
          <div
            className="pointer-events-none absolute -top-40 -right-40 h-[34rem] w-[34rem] rounded-full opacity-[0.14]"
            style={{
              background:
                "radial-gradient(circle, var(--color-gold) 0%, transparent 65%)",
            }}
            aria-hidden
          />
          <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16 pt-36 pb-20 md:pt-44 md:pb-28">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-20 items-center">
              <div>
                <ScrollReveal>
                  <div className="mb-7 flex items-center gap-4">
                    <div className="h-px w-10 bg-gold/60" />
                    <p
                      className="uppercase text-paper/50"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "10px",
                        letterSpacing: "0.35em",
                      }}
                    >
                      A New Charmistry Collection
                    </p>
                  </div>
                  <h1
                    className="uppercase leading-[0.95] text-paper"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "clamp(3rem, 8vw, 6.5rem)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    The Daily{" "}
                    <em className="text-gold-light" style={{ fontStyle: "italic" }}>
                      Affair
                    </em>
                  </h1>
                  <p
                    className="mt-8 max-w-md text-paper/60"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      letterSpacing: "0.03em",
                      lineHeight: 1.85,
                    }}
                  >
                    Some pieces you wear. These, you keep returning to — from
                    the first coffee to the last light. A collection for the
                    romance hiding inside an ordinary day.
                  </p>
                  <div className="mt-10 flex flex-wrap items-center gap-5">
                    <a
                      href="#pieces"
                      className="inline-flex items-center gap-2.5 border border-paper/40 px-8 py-3.5 text-[10px] tracking-[0.25em] uppercase font-body text-paper hover:bg-paper hover:text-ink transition-colors"
                    >
                      Preview the pieces
                    </a>
                    <span
                      className="uppercase text-gold-light/80"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "10px",
                        letterSpacing: "0.25em",
                      }}
                    >
                      Full reveal coming soon
                    </span>
                  </div>
                </ScrollReveal>
              </div>

              {/* Hero image slot */}
              <ScrollReveal delay={0.1}>
                <PlaceholderFrame
                  label="Campaign photograph coming soon"
                  className="aspect-[4/5] bg-paper/10"
                />
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ── Story ── */}
        <section className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16 py-20 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
            <ScrollReveal className="md:col-span-5">
              <PlaceholderFrame className="aspect-[3/4]" />
            </ScrollReveal>
            <div className="md:col-span-4 md:pt-16">
              <ScrollReveal delay={0.05}>
                <p
                  className="mb-4 uppercase text-gold-dark"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "10px",
                    letterSpacing: "0.3em",
                  }}
                >
                  The idea
                </p>
                <h2
                  className="font-display text-3xl md:text-4xl font-light leading-tight"
                >
                  Worn daily.
                  <br />
                  Never routine.
                </h2>
                <p
                  className="mt-6 text-ink/60"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "13.5px",
                    letterSpacing: "0.03em",
                    lineHeight: 1.85,
                  }}
                >
                  Waterproof, tarnish-resistant pieces made for repetition —
                  the kind you fasten once and forget, then catch in the
                  mirror at golden hour. The Daily Affair is built to layer
                  with everything already on your skin.
                </p>
              </ScrollReveal>
            </div>
            <ScrollReveal delay={0.1} className="md:col-span-3 md:pt-32">
              <PlaceholderFrame className="aspect-square" />
            </ScrollReveal>
          </div>
        </section>

        {/* ── Pieces teaser ── */}
        <section
          id="pieces"
          className="border-t border-ink/10 scroll-mt-24"
        >
          <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16 py-20 md:py-24">
            <ScrollReveal>
              <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
                <div>
                  <p
                    className="mb-3 uppercase text-ink/40"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "10px",
                      letterSpacing: "0.3em",
                    }}
                  >
                    The line-up
                  </p>
                  <h2
                    className="uppercase leading-[1.05]"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "clamp(2rem, 4vw, 3.4rem)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    Four pieces, <em style={{ fontStyle: "italic" }}>one</em>{" "}
                    affair
                  </h2>
                </div>
                <p
                  className="max-w-xs text-ink/50 md:text-right"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                    letterSpacing: "0.06em",
                    lineHeight: 1.7,
                  }}
                >
                  Each piece is revealed with the collection launch — sign up
                  below to see them first.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {TEASER_PIECES.map((piece, i) => (
                <ScrollReveal key={piece.num} delay={i * 0.06}>
                  <div className="group">
                    <PlaceholderFrame
                      label="Reveal coming soon"
                      className="aspect-[4/5]"
                    />
                    <div className="mt-3 flex items-baseline gap-3">
                      <span
                        className="text-gold-dark"
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: "13px",
                          letterSpacing: "0.1em",
                        }}
                      >
                        {piece.num}
                      </span>
                      <span
                        className="uppercase text-ink/55"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "10px",
                          letterSpacing: "0.22em",
                        }}
                      >
                        {piece.role}
                      </span>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="border-t border-ink/10">
          <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16 py-16 md:py-20 flex flex-col items-center text-center gap-6">
            <p
              className="max-w-md text-ink/55"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                letterSpacing: "0.04em",
                lineHeight: 1.8,
              }}
            >
              While you wait — the pieces you&apos;ll layer it with are already
              here.
            </p>
            <Link
              href="/shop"
              className="group inline-flex items-center gap-2.5 border border-ink px-8 py-3.5 text-[10px] tracking-[0.25em] uppercase font-body text-ink hover:bg-ink hover:text-paper transition-colors"
            >
              Browse All Pieces
              <svg
                className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
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
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
