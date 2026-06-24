/** AboutSection — "Made to be lived in" brand statement with lifestyle video. */

"use client";

import { motion } from "framer-motion";
import ScrollReveal from "@/components/ui/ScrollReveal";

const FEATURES = [
  { label: "Shower proof:", value: "Absolutely." },
  { label: "Tarnish resistant:", value: "100% (No green skin, ever)." },
  { label: "High maintenance:", value: "Never." },
];

export default function AboutSection() {
  return (
    <section id="about" className="bg-paper overflow-hidden scroll-mt-24">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left: lifestyle video */}
          <div className="relative aspect-[4/5] lg:aspect-[3/4] overflow-hidden">
            <motion.div
              className="absolute inset-0"
              initial={{ scale: 1.06 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Decorative, muted, auto-looping. Poster paints instantly while
                  the (lazily fetched) video streams in; WebM is preferred where
                  supported, with an H.264 MP4 fallback. */}
              <video
                className="absolute inset-0 h-full w-full object-cover object-center"
                poster="/videos/about-slow-mornings-poster.webp"
                autoPlay
                muted
                loop
                playsInline
                preload="none"
                aria-label="Charmistry stainless steel jewellery worn through a slow morning routine"
              >
                <source src="/videos/about-slow-mornings.webm" type="video/webm" />
                <source src="/videos/about-slow-mornings.mp4" type="video/mp4" />
              </video>
            </motion.div>
          </div>

          {/* Right: brand statement */}
          <div className="flex flex-col justify-center py-4 lg:py-8">
            <ScrollReveal direction="left" delay={0.1}>
              <h2
                className="text-ink uppercase leading-none mb-8"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "clamp(2.5rem, 5vw, 4rem)",
                  letterSpacing: "-0.01em",
                }}
              >
                Made to be
                <br />
                <em style={{ fontStyle: "italic" }}>Lived In</em>
              </h2>
            </ScrollReveal>

            <ScrollReveal direction="left" delay={0.22}>
              <div className="space-y-7 text-center lg:text-left">
                <p
                  className="text-ink-secondary leading-relaxed mx-auto lg:mx-0 max-w-md"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "16.5px",
                    letterSpacing: "0.01em",
                  }}
                >
                  Your jewellery should keep up with your life, not complicate
                  it. Made from durable stainless steel, Charmistry pieces are
                  designed to handle whatever your day throws at them.
                </p>

                <ul className="flex flex-col gap-3 border-y border-ink/10 py-6">
                  {FEATURES.map((f) => (
                    <li
                      key={f.label}
                      className="uppercase"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "13px",
                        letterSpacing: "0.14em",
                      }}
                    >
                      <span className="text-ink font-semibold">{f.label}</span>{" "}
                      <span className="text-ink-tertiary">{f.value}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  <p
                    className="text-ink font-semibold uppercase"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      letterSpacing: "0.16em",
                    }}
                  >
                    No fading. No rust.
                  </p>
                  <p
                    className="text-ink-tertiary leading-relaxed mx-auto lg:mx-0 max-w-md"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "15px",
                      letterSpacing: "0.01em",
                    }}
                  >
                    Just Charmistry essentials made for your daily rotation.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
