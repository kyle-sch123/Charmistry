/** AboutSection — "Made to be lived in" brand statement with lifestyle video. */

"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import ScrollReveal from "@/components/ui/ScrollReveal";

// Each promise reads as a ticked box rather than a question/answer pair — the
// claim carries itself, so the check is the whole answer.
const FEATURES = ["Shower-safe", "Sweat-safe", "Sea-safe"];

export default function AboutSection() {
  // `preload="none"` is a hint autoplay overrides: Chrome fetched the 600KB
  // WebM during the initial page load even though this section sits well below
  // the fold, so it competed with the hero image for bandwidth. Withholding the
  // <source> elements until the section approaches the viewport is the only
  // reliable way to hold the fetch back.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sourcesMounted, setSourcesMounted] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setSourcesMounted(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSourcesMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Sources added after mount are invisible to the element until it re-reads
  // them; load() also kicks off autoplay.
  useEffect(() => {
    if (sourcesMounted) videoRef.current?.load();
  }, [sourcesMounted]);

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
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-cover object-center"
                poster="/videos/about-slow-mornings-poster.webp"
                autoPlay
                muted
                loop
                playsInline
                preload="none"
                aria-label="Charmistry stainless steel jewellery worn through a slow morning routine"
              >
                {sourcesMounted && (
                  <>
                    <source
                      src="/videos/about-slow-mornings.webm"
                      type="video/webm"
                    />
                    <source
                      src="/videos/about-slow-mornings.mp4"
                      type="video/mp4"
                    />
                  </>
                )}
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
                  {FEATURES.map((label) => (
                    <li
                      key={label}
                      className="flex items-center justify-center lg:justify-start gap-2.5 uppercase"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "13px",
                        letterSpacing: "0.14em",
                      }}
                    >
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-gold-dark"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-ink font-semibold">{label}</span>
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
