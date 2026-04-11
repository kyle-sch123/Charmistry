"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import heroImage from "@/assets/images/hero-section.webp";

const LETTERS = "Charmistry".split("");

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
          alt="Luxury jewelry editorial"
          fill
          className="object-cover object-center"
          priority
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

      {/* Center content */}
      <motion.div
        className="absolute inset-0 z-20 flex flex-col items-center justify-center"
        style={{ opacity: contentOpacity, y: contentY }}
      >
        {/* Top accent */}
        <motion.div
          className="flex items-center gap-5 mb-10"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          style={{ transformOrigin: "center" }}
        >
          <div className="h-px w-12 sm:w-20 bg-white/60" />
          <span
            className="text-white/80 text-[10px] tracking-[0.35em] sm:tracking-[0.55em] uppercase"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Est. 2024
          </span>
          <div className="h-px w-12 sm:w-20 bg-white/60" />
        </motion.div>

        {/* Brand name — Gilda Display, letter by letter */}
        <h1
          className="flex items-baseline overflow-hidden pb-[0.2em]"
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(2.2rem, 13vw, 11.5rem)",
            lineHeight: 0.88,
            letterSpacing: "0.06em",
            fontWeight: 400,
          }}
          aria-label="Charmistry"
        >
          {LETTERS.map((char, i) => (
            <motion.span
              key={i}
              className="inline-block text-white"
              initial={{ y: "110%", opacity: 0, rotateX: 45 }}
              animate={{ y: "0%", opacity: 1, rotateX: 0 }}
              transition={{
                duration: 0.85,
                delay: 0.35 + i * 0.055,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {char}
            </motion.span>
          ))}
        </h1>

        {/* Bottom accent */}
        <motion.div
          className="flex items-center gap-5 mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.3 }}
        >
          <div className="h-px w-8 sm:w-12 bg-white/55" />
          <span
            className="text-white/75 text-[10px] tracking-[0.3em] sm:tracking-[0.55em] uppercase"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Luxury Jewellery
          </span>
          <div className="h-px w-8 sm:w-12 bg-white/55" />
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-9 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        style={{ opacity: contentOpacity }}
      >
        <motion.div
          className="w-px h-11 origin-top bg-gradient-to-b from-white/50 to-transparent"
          animate={{ scaleY: [0, 1, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <span
          className="text-white/60 text-[10px] tracking-[0.4em] uppercase"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Scroll
        </span>
      </motion.div>

      {/* Corner label — top left */}
      <motion.div
        className="absolute top-28 left-7 z-20 hidden lg:block"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 1.8 }}
      >
        <span
          className="text-white/55 text-[9px] tracking-[0.35em] uppercase [writing-mode:vertical-rl] rotate-180"
          style={{ fontFamily: "var(--font-body)" }}
        >
          South Africa
        </span>
      </motion.div>

      {/* Corner label — top right */}
      <motion.div
        className="absolute top-28 right-7 z-20 hidden lg:block"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 1.8 }}
      >
        <span
          className="text-white/55 text-[9px] tracking-[0.35em] uppercase [writing-mode:vertical-rl]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Handcrafted
        </span>
      </motion.div>
    </section>
  );
}
