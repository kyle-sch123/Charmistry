/**
 * AssuranceBanner — a four-part promise strip shown just above the footer on the
 * home page. Each pillar pairs a delicate line icon (in a hairline ring) with a
 * serif heading + supporting line; a gold-diamond eyebrow frames the band and
 * hover warms the icon to gold with a sweeping underline. Restates the brand's
 * core wear promises: waterproof, tarnish-resistant, kind to skin, and the
 * 12-month guarantee that backs them.
 *
 * Deliberately the most compact band on the page — it is the last thing before
 * the footer, so it closes the argument rather than restating it at full
 * volume.
 *
 * Server component — the only interactive part is the ScrollReveal wrapper,
 * which is a client component in its own right.
 */

import type { ReactNode } from "react";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { cn } from "@/lib/utils";

interface Assurance {
  title: string;
  copy: string;
  icon: ReactNode;
}

const iconProps = {
  width: 21,
  height: 21,
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
    title: "12-Month Guarantee",
    copy: "Tarnishes or faults? Replaced free.",
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
      className="relative bg-paper-warm border-t border-ink/10 defer-paint"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pt-10 pb-10 md:pt-14 md:pb-16">
        {/* Eyebrow — gold diamond ornament framing the band */}
        <ScrollReveal className="mb-7 flex flex-col items-center">
          <div className="mb-3 flex items-center gap-3">
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
              fontSize: "9px",
              letterSpacing: "0.32em",
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
                "group relative flex flex-col items-center px-3 py-4 text-center sm:px-5 lg:py-3",
              )}
            >
              {/* Hairline rule in the gutter to the item's left — between
                  columns only: the 2-col mobile split (odd items) and the 4-col
                  desktop row (every item but the first). */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute left-0 top-1/2 h-14 w-px -translate-y-1/2 bg-ink/12",
                  i % 2 === 0 ? "hidden" : "block",
                  i % 4 === 0 ? "lg:hidden" : "lg:block",
                )}
              />

              {/* Icon in a hairline ring — warms to gold and lifts on hover */}
              <span className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-full border border-ink/12 text-ink/70 transition-all duration-500 ease-out group-hover:-translate-y-0.5 group-hover:border-gold/45 group-hover:text-gold-dark group-hover:shadow-[0_10px_30px_-16px_rgba(154,123,47,0.6)]">
                {item.icon}
              </span>

              <h3
                className="text-ink uppercase"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(0.78rem, 1.1vw, 0.95rem)",
                  letterSpacing: "0.16em",
                  fontWeight: 500,
                }}
              >
                {item.title}
              </h3>

              {/* Gold underline that sweeps in from the centre on hover */}
              <span
                aria-hidden
                className="mt-2 h-px w-6 origin-center scale-x-0 bg-gold transition-transform duration-500 ease-out group-hover:scale-x-100"
              />

              <p
                className="mt-2 max-w-[13rem] text-ink/55"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(0.85rem, 1.1vw, 0.95rem)",
                  letterSpacing: "0.01em",
                  lineHeight: 1.5,
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
