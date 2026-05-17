"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { useEmailSubscribe } from "@/hooks/useEmailSubscribe";

export default function EmailClub() {
  const [email, setEmail] = useState("");
  const { status, discountCode, subscribe } = useEmailSubscribe();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email) {
      subscribe(email);
      setEmail("");
    }
  }

  return (
    <section
      id="contact"
      className="bg-paper border-t border-stone scroll-mt-24"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pt-14 md:pt-20 pb-10 md:pb-14 text-center">
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
            <div className="relative max-w-sm mx-auto flex items-center h-12 rounded-full border border-ink overflow-hidden">
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
                className="shrink-0 w-11 h-11 mr-0.5 rounded-full bg-ink text-paper flex items-center justify-center transition-opacity duration-200 disabled:opacity-50 cursor-pointer"
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
