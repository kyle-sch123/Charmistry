/**
 * Home hero — full-bleed image with parallax scale, scroll-fade copy.
 *
 * Perf note: every *entrance* animation here is CSS (see the `hero-*`
 * keyframes in globals.css), not framer-motion `initial`/`animate`. A JS
 * entrance ships the element to the browser at `opacity: 0` and only reveals
 * it once the client bundle has hydrated — and the headline below is this
 * page's LCP element, so that cost 3.7s of pure render delay on throttled
 * mobile. CSS animations start on first paint. framer-motion is kept only for
 * the scroll-linked parallax, which has nothing to reveal.
 */

"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import heroImage from "@/assets/images/hero-section.webp";

export default function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 0.7], ["0%", "-12%"]);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden"
    >
      {/* Full-bleed image with parallax */}
      <motion.div
        className="absolute inset-0"
        style={{ scale: imageScale, y: imageY }}
      >
        <Image
          src={heroImage}
          alt="Luxury jewellry editorial"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        {/* Slight overlay to keep text legible */}
        <div className="absolute inset-0 bg-black/20" />
      </motion.div>

      {/* Grain texture */}
      <div
        className="absolute inset-0 z-10 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* Center content — the wrapper carries only the scroll-linked fade, so
          the CSS entrance animations below never fight an inline style. */}
      <motion.div
        className="absolute inset-0 z-20 flex flex-col items-center justify-center"
        style={{ opacity: contentOpacity, y: contentY }}
      >
        {/* Top accent */}
        <div className="flex items-center gap-5 mb-10 animate-hero-fade [animation-delay:0.2s]">
          <div className="h-px w-12 sm:w-20 bg-white/60" />
          <span
            className="text-white/80 text-[10px] tracking-[0.35em] sm:tracking-[0.55em] uppercase"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Est. 2025
          </span>
          <div className="h-px w-12 sm:w-20 bg-white/60" />
        </div>

        {/* Brand name — single blur-dissolve reveal */}
        <h1
          className="text-white animate-hero-dissolve [animation-delay:0.025s]"
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(2.2rem, 13vw, 11.5rem)",
            lineHeight: 0.88,
            letterSpacing: "0.05em",
            fontWeight: 400,
            textTransform: "uppercase",
          }}
        >
          Charmistry
        </h1>

        {/* Bottom accent */}
        <div className="flex items-center gap-5 mt-10 animate-hero-fade [animation-delay:0.35s]">
          <div className="h-px w-8 sm:w-12 bg-white/55" />
          <span
            className="text-white/75 text-[10px] tracking-[0.3em] sm:tracking-[0.55em] uppercase"
            style={{ fontFamily: "var(--font-body)" }}
          >
            THE JEWELLERY YOU LIVE IN
          </span>
          <div className="h-px w-8 sm:w-12 bg-white/55" />
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-9 left-1/2 -translate-x-1/2 z-20"
        style={{ opacity: contentOpacity }}
      >
        <div className="flex flex-col items-center gap-2.5 animate-hero-fade [animation-delay:2.2s] [animation-duration:1.2s]">
          <div className="w-px h-11 origin-top bg-gradient-to-b from-white/50 to-transparent animate-hero-scan" />
          <span
            className="text-white/60 text-[10px] tracking-[0.4em] uppercase"
            style={{ fontFamily: "var(--font-body)" }}
          >
            EXPLORE BESTSELLERS
          </span>
        </div>
      </motion.div>

      {/* Corner label — top left */}
      <div className="absolute top-28 left-7 z-20 hidden lg:block animate-hero-slide-left [animation-delay:2s]">
        <span
          className="text-white/55 text-[9px] tracking-[0.35em] uppercase [writing-mode:vertical-rl] rotate-180"
          style={{ fontFamily: "var(--font-body)" }}
        >
          South Africa
        </span>
      </div>

      {/* Corner label — top right */}
      <div className="absolute top-28 right-7 z-20 hidden lg:block animate-hero-slide-right [animation-delay:2s]">
        <span
          className="text-white/55 text-[9px] tracking-[0.35em] uppercase [writing-mode:vertical-rl]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          High Quality
        </span>
      </div>
    </section>
  );
}
