/**
 * Testimonials section — infinite-scroll marquee of customer quotes.
 * The track is the testimonials array doubled so the CSS keyframe can
 * loop seamlessly (translateX from 0 to -50%).
 */

"use client";

import { motion } from "framer-motion";
import { testimonials } from "@/data/testimonials";
import { Testimonial } from "@/types";

const track = [...testimonials, ...testimonials];

export default function Testimonials() {
  return (
    <section className="bg-paper py-0 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(340px,420px)] xl:grid-cols-[1fr_460px] gap-6 lg:gap-8 items-center">
          {/* ── Right (desktop): sticky heading ── */}
          <motion.div
            className="lg:order-2 lg:sticky lg:top-32 self-start lg:text-right"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2
              className="text-ink uppercase leading-[1.1] mb-6 text-balance"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(2.3rem, 4.4vw, 4rem)",
                letterSpacing: "0.02em",
              }}
            >
              What the
              <br />
              <em style={{ fontStyle: "italic" }}>Charmistry</em>
              <br />
              <em style={{ fontStyle: "italic" }}>Girls</em>
              <br />
              are saying
            </h2>

            <div className="flex items-center gap-1 mb-3 lg:justify-end">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} />
              ))}
            </div>
            <p
              className="text-ink/45"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              100% verified reviews
            </p>
          </motion.div>

          {/* ── Left (desktop): infinite marquee ── */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative overflow-hidden lg:order-1"
            style={{
              maskImage:
                "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
            }}
          >
            <div className="marquee-track flex gap-4 w-max">
              {track.map((t, i) => (
                <TestimonialCard key={`${t.id}-${i}`} testimonial={t} />
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes testimonials-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .marquee-track {
          animation: testimonials-scroll 30s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}

function StarIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 text-ink"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <article
      className="
        flex flex-col items-start gap-5
        border border-ink/12 rounded-2xl
        px-7 py-7
        w-[272px] shrink-0
        bg-paper
        transition-all duration-300
        hover:border-ink/30 hover:shadow-[0_4px_32px_rgba(10,10,10,0.07)]
      "
    >
      {/* Stars */}
      <div className="flex gap-1" aria-label="5 stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon key={i} />
        ))}
      </div>

      {/* Quote */}
      <blockquote
        className="text-ink leading-relaxed flex-1"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "12.5px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        &ldquo;{testimonial.text}&rdquo;
      </blockquote>

      {/* Footer */}
      <footer className="flex flex-col gap-0.5 w-full pt-3 border-t border-ink/8">
        <cite
          className="text-ink not-italic"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11.5px",
            fontWeight: 500,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
          }}
        >
          {testimonial.customerName}
        </cite>
        <span
          className="text-ink/40"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            letterSpacing: "0.04em",
          }}
        >
          {testimonial.productName}
        </span>
      </footer>
    </article>
  );
}
