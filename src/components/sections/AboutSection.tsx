/** AboutSection — two-column "Jewelry That Keeps Up" brand statement. */

"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import About from "@/assets/images/About.webp";
import ScrollReveal from "@/components/ui/ScrollReveal";

export default function AboutSection() {
  return (
    <section id="about" className="bg-paper overflow-hidden scroll-mt-24">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left: image */}
          <div className="relative aspect-[4/3] sm:aspect-[3/2] lg:aspect-[3/4] overflow-hidden">
            <motion.div
              className="absolute inset-0"
              initial={{ scale: 1.06 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Image
                src={About}
                alt="Charmistry jewellry lifestyle"
                fill
                className="object-cover object-center"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 50vw"
              />
            </motion.div>
          </div>

          {/* Right: brand statement */}
          <div className="flex flex-col justify-center py-4 lg:py-8">
            <ScrollReveal direction="left" delay={0.1}>
              <h2
                className="text-ink uppercase leading-none mb-10"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "clamp(2.5rem, 5vw, 4rem)",
                  letterSpacing: "-0.01em",
                }}
              >
                Jewellry
                <br />
                That Keeps Up
              </h2>
            </ScrollReveal>

            <ScrollReveal direction="left" delay={0.22}>
              <div className="space-y-5 text-center lg:text-left">
                <p
                  className="text-ink-tertiary uppercase leading-relaxed"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "11px",
                    letterSpacing: "0.2em",
                  }}
                >
                  We believe in pieces that keep up with your everyday.
                </p>
                <p
                  className="text-ink-tertiary uppercase leading-relaxed"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "11px",
                    letterSpacing: "0.2em",
                  }}
                >
                  That&apos;s why our jewellry is made from high-quality
                  stainless steel.
                </p>
                <p
                  className="text-ink-tertiary uppercase leading-relaxed"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "11px",
                    letterSpacing: "0.2em",
                  }}
                >
                  Water-resistant, tarnish-resistant and designed to be worn
                  daily.
                </p>
                <p
                  className="text-ink font-semibold uppercase"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "11px",
                    letterSpacing: "0.2em",
                  }}
                >
                  No fading. No taking it off.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
