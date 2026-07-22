/**
 * AssuranceBanner — a four-part promise strip shown just above the footer on the
 * home page. Each pillar pairs a delicate line icon (in a hairline ring) with a
 * serif heading + supporting line; a gold-diamond eyebrow frames the band and
 * hover warms the icon to gold with a sweeping underline. Restates the brand's
 * core wear guarantees: waterproof, tarnish-resistant, kind to skin, built to
 * last.
 */

"use client";

import type { ReactNode } from "react";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { cn } from "@/lib/utils";

interface Assurance {
  title: string;
  copy: string;
  icon: ReactNode;
}

const iconProps = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ASSURANCES: Assurance[] = [
  {
    title: "Waterproof",
    copy: "Wear it in the shower, pool & beyond.",
    icon: (
      <svg {...iconProps}>
        <path d="M12 3s6 6.4 6 10.4a6 6 0 0 1-12 0C6 9.4 12 3 12 3z" />
        <path d="M9.5 13.2a2.6 2.6 0 0 0 2 2.3" />
      </svg>
    ),
  },
  {
    title: "Tarnish-Resistant",
    copy: "Made to keep shining, day after day.",
    icon: (
      <svg {...iconProps}>
        <path d="M12 2.5l1.9 6 6 1.9-6 1.9-1.9 6-1.9-6-6-1.9 6-1.9z" />
        <path d="M18.5 15.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" />
      </svg>
    ),
  },
  {
    title: "Sensitive-Skin Friendly",
    copy: "Perfect for everyday wear.",
    icon: (
      <svg {...iconProps}>
        <path d="M12 20.5S4 15.9 4 9.9A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 8 1.9c0 6-8 10.6-8 10.6z" />
      </svg>
    ),
  },
  {
    title: "Made to Last",
    copy: "Quality you can feel, pieces you'll love.",
    icon: (
      <svg {...iconProps}>
        <path d="M12 3l7 2.8v5c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9v-5z" />
        <path d="M9 12l2.1 2.1L15 10.2" />
      </svg>
    ),
  },
];

export default function AssuranceBanner() {
  return (
    <section
      aria-label="Why Charmistry"
      className="relative bg-paper-warm border-t border-ink/10"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pt-[60px] pb-16 md:pb-24">
        {/* Eyebrow — gold diamond ornament framing the band */}
        <ScrollReveal className="mb-[33px] flex flex-col items-center">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-8 bg-gold/50" />
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <rect
                x="6"
                y="3"
                width="4.24"
                height="4.24"
                fill="#C9A84C"
                transform="rotate(45 6 6)"
              />
            </svg>
            <span className="h-px w-8 bg-gold/50" />
          </div>
          <p
            className="text-ink/45 uppercase"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "10px",
              letterSpacing: "0.35em",
            }}
          >
            The Charmistry Promise
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-2 lg:grid-cols-4">
          {ASSURANCES.map((item, i) => (
            <ScrollReveal
              key={item.title}
              delay={0.1 + i * 0.1}
              className={cn(
                "group relative flex flex-col items-center px-4 py-5 text-center sm:px-6 lg:py-4",
              )}
            >
              {/* Hairline rule in the gutter to the item's left — between
                  columns only: the 2-col mobile split (odd items) and the 4-col
                  desktop row (every item but the first). */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute left-0 top-1/2 h-20 w-px -translate-y-1/2 bg-ink/12",
                  i % 2 === 0 ? "hidden" : "block",
                  i % 4 === 0 ? "lg:hidden" : "lg:block",
                )}
              />

              {/* Icon in a hairline ring — warms to gold and lifts on hover */}
              <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-ink/12 text-ink/70 transition-all duration-500 ease-out group-hover:-translate-y-0.5 group-hover:border-gold/45 group-hover:text-gold-dark group-hover:shadow-[0_10px_30px_-16px_rgba(154,123,47,0.6)]">
                {item.icon}
              </span>

              <h3
                className="text-ink uppercase"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(0.95rem, 1.4vw, 1.15rem)",
                  letterSpacing: "0.18em",
                  fontWeight: 500,
                }}
              >
                {item.title}
              </h3>

              {/* Gold underline that sweeps in from the centre on hover */}
              <span
                aria-hidden
                className="mt-2.5 h-px w-7 origin-center scale-x-0 bg-gold transition-transform duration-500 ease-out group-hover:scale-x-100"
              />

              <p
                className="mt-3 max-w-[15rem] text-ink/55"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(0.95rem, 1.3vw, 1.05rem)",
                  letterSpacing: "0.01em",
                  lineHeight: 1.55,
                }}
              >
                {item.copy}
              </p>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
