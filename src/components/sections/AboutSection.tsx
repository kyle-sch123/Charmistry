"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import About from "@/assets/images/About.webp";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { useEmailSubscribe } from "@/hooks/useEmailSubscribe";

export default function AboutSection() {
  const [email, setEmail] = useState("");
  const { status, discountCode, subscribe } = useEmailSubscribe();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email) subscribe(email);
    if (status === "success") setEmail("");
  }

  return (
    <section className="bg-paper overflow-hidden">
      {/* Zone A — split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Left: full-bleed image */}
        <div className="relative aspect-[3/4] lg:aspect-auto lg:min-h-[620px]">
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.06 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Image
              src={About}
              alt="Charmistry jewelry lifestyle"
              fill
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </motion.div>
        </div>

        {/* Right: brand statement */}
        <div className="flex flex-col justify-center px-6 md:px-16 lg:px-20 py-16 md:py-24">
          <ScrollReveal direction="left" delay={0.1}>
            <h2
              className="text-ink uppercase leading-none mb-10"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(2.5rem, 5vw, 4rem)",
                letterSpacing: "-0.01em",
              }}
            >
              Jewelry
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
                That&apos;s why our jewelry is made from high-quality stainless
                steel.
              </p>
              <p
                className="text-ink-tertiary uppercase leading-relaxed"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "11px",
                  letterSpacing: "0.2em",
                }}
              >
                Waterproof, tarnish-resistant and designed to be worn daily.
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

      {/* Zone B — email club strip */}
      <div className="pt-14 md:pt-20 pb-6 md:pb-8 px-6 text-center border-t border-stone">
        <ScrollReveal direction="up" delay={0.05}>
          <h3
            className="text-ink uppercase"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(1.25rem, 3vw, 2rem)",
              letterSpacing: "0.15em",
            }}
          >
            Join the Charmistry Club
          </h3>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.15}>
          <form onSubmit={handleSubmit} className="mt-8">
            <div
              className="relative max-w-sm mx-auto flex items-center h-12 rounded-full border border-ink overflow-hidden"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                disabled={status === "loading" || status === "success"}
                className="flex-1 h-full bg-transparent pl-6 pr-2 text-ink placeholder:text-ash focus:outline-none"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "11px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
                aria-label="Email address"
              />
              <button
                type="submit"
                disabled={status === "loading" || status === "success"}
                className="shrink-0 w-11 h-11 mr-1 rounded-full bg-ink text-paper flex items-center justify-center transition-opacity duration-200 disabled:opacity-50 cursor-pointer"
                aria-label="Subscribe"
              >
                {status === "loading" ? (
                  <span className="w-4 h-4 rounded-full border-2 border-paper/30 border-t-paper animate-spin block" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M1 7h12M8 2l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </ScrollReveal>

        {/* Feedback states */}
        <AnimatePresence mode="wait">
          {status === "success" && discountCode && (
            <motion.div
              key="success"
              className="mt-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
            >
              <p
                className="text-ink-tertiary uppercase mb-3"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                }}
              >
                Welcome! Your discount code:
              </p>
              <span
                className="inline-block border border-ink px-5 py-2 text-ink font-semibold"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "18px",
                  letterSpacing: "0.15em",
                }}
              >
                {discountCode}
              </span>
              <p
                className="text-ash mt-2"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                }}
              >
                10% off your first order. Check your inbox for details.
              </p>
            </motion.div>
          )}

          {status === "duplicate" && (
            <motion.p
              key="duplicate"
              className="mt-5 text-ink-tertiary uppercase"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "10px",
                letterSpacing: "0.2em",
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              You&apos;re already on the list.
            </motion.p>
          )}

          {status === "error" && (
            <motion.p
              key="error"
              className="mt-5 text-ink-tertiary uppercase"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "10px",
                letterSpacing: "0.2em",
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              Something went wrong — please try again.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
