"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const sections = [
  {
    num: "01",
    title: "Care Instructions",
    content: (
      <>
        <p>To extend the lifespan of your jewellery:</p>
        <ul>
          <li>avoid harsh chemicals and perfumes;</li>
          <li>store pieces in a dry place;</li>
          <li>avoid excessive moisture exposure where possible;</li>
          <li>gently clean with a soft cloth.</li>
        </ul>
        <div className="border-l-2 border-ink/20 bg-ink/[0.03] rounded-r-lg px-5 py-4 my-2">
          <p className="!mb-0">
            While many Charmistry pieces are{" "}
            <span className="font-medium text-ink">
              water-resistant and tarnish-resistant
            </span>
            , proper care is still recommended to keep your pieces looking their
            best.
          </p>
        </div>
      </>
    ),
  },
];

const pills = [
  "Stainless steel",
  "Tarnish-resistant",
  "Water-resistant",
  "Everyday wear",
];

export default function JewelleryCareGuide() {
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <Navbar />
      <section
        ref={sectionRef}
        className="bg-paper relative py-16 md:py-24 overflow-hidden"
      >
        <div className="max-w-3xl mx-auto px-6 md:px-10 lg:px-16">
          {/* Hero */}
          <div className="border-b border-ink/10 pb-10 mb-12">
            {/* Eyebrow */}
            <motion.div
              className="flex items-center gap-4 mb-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <div className="h-px w-8 bg-ink/30" />
              <span
                className="text-ink/50 uppercase"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.25em",
                }}
              >
                Guide
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              className="text-ink uppercase leading-[1.08] mb-5"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(2rem, 5vw, 3.4rem)",
                letterSpacing: "0.02em",
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              Jewellery
              <br />
              Care Guide
            </motion.h1>

            {/* Intro */}
            <motion.p
              className="text-ink/55 max-w-xl"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                lineHeight: "1.85",
                letterSpacing: "0.02em",
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.2,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              Charmistry pieces are crafted from stainless steel and designed
              for everyday wear. Following these simple care tips will help
              maintain their quality and extend their lifespan.
            </motion.p>

            {/* Pills */}
            <motion.div
              className="flex flex-wrap gap-2 mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35 }}
            >
              {pills.map((pill) => (
                <span
                  key={pill}
                  className="border border-ink/12 rounded-full text-ink/45 uppercase"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "10px",
                    letterSpacing: "0.18em",
                    padding: "5px 14px",
                  }}
                >
                  {pill}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Sections */}
          <div className="flex flex-col">
            {sections.map((section, i) => (
              <motion.div
                key={section.num}
                className="border-b border-ink/10 py-7 last:border-b-0"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.55,
                  delay: i < 3 ? i * 0.08 : 0,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {/* Section header */}
                <div className="flex items-start gap-4 mb-4">
                  <span
                    className="text-ink/30 uppercase shrink-0 pt-[3px]"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "10px",
                      letterSpacing: "0.2em",
                      minWidth: "22px",
                    }}
                  >
                    {section.num}
                  </span>
                  <h2
                    className="text-ink uppercase leading-snug"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {section.title}
                  </h2>
                </div>

                {/* Section body */}
                <div
                  className="pl-[38px] text-ink/55 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_p]:leading-[1.85] [&_ul]:mt-2 [&_ul]:mb-3 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_li]:flex [&_li]:items-baseline [&_li]:gap-2 [&_li]:leading-[1.8] [&_li]:before:content-['—'] [&_li]:before:text-ink/25 [&_li]:before:shrink-0 [&_li]:before:text-[11px]"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "13px",
                    letterSpacing: "0.02em",
                    fontWeight: 300,
                  }}
                >
                  {section.content}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
