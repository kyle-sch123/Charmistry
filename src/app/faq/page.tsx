/** Static content page — FAQ, rendered as an editorial accordion. */

"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const linkClass =
  "underline underline-offset-4 decoration-ink/30 hover:decoration-ink transition-all duration-200";

type FaqItem = { q: string; a: ReactNode };
type FaqGroup = { category: string; items: FaqItem[] };

const faqGroups: FaqGroup[] = [
  {
    category: "Shipping & Delivery",
    items: [
      {
        q: "What are my shipping options?",
        a: (
          <>
            <p>
              You choose your carrier at checkout — both fulfilled by{" "}
              <Link
                href="https://thecourierguy.co.za"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                The Courier Guy
              </Link>
              :
            </p>
            <ul>
              <li>
                <span className="font-medium text-ink">
                  Locker-to-Locker — R49.
                </span>{" "}
                Collect from a secure locker near you.
              </li>
              <li>
                <span className="font-medium text-ink">
                  Standard Economy — R79.
                </span>{" "}
                Door-to-door delivery to your address.
              </li>
            </ul>
            <p>
              Shipping is{" "}
              <span className="font-medium text-ink">free on orders over R600</span>
              , whichever option you pick.
            </p>
          </>
        ),
      },
      {
        q: "How long does delivery take?",
        a: (
          <p>
            Within South Africa, Locker-to-Locker takes{" "}
            <span className="font-medium text-ink">2–4 working days</span> and
            Standard Economy{" "}
            <span className="font-medium text-ink">3–5 working days</span>. These
            are estimates and may vary over peak periods or public holidays.
          </p>
        ),
      },
      {
        q: "How does Locker-to-Locker delivery work?",
        a: (
          <p>
            Your order is sent to a nearby collection locker. Add your preferred
            locker in the{" "}
            <span className="font-medium text-ink">order notes</span> at
            checkout, or email it to{" "}
            <a href="mailto:charmistryza@gmail.com" className={linkClass}>
              charmistryza@gmail.com
            </a>
            . If you don&apos;t specify one, we&apos;ll send it to the nearest
            available locker to your address.
          </p>
        ),
      },
      {
        q: "Do you offer tracking?",
        a: (
          <p>
            Yes — a tracking number is emailed to you the moment your order is
            dispatched.
          </p>
        ),
      },
      {
        q: "Do you ship internationally?",
        a: <p>Not yet. We currently ship within South Africa only.</p>,
      },
    ],
  },
  {
    category: "Payments & Discounts",
    items: [
      {
        q: "What payment methods do you accept?",
        a: (
          <p>
            Secure online payments are processed through{" "}
            <Link
              href="https://www.payfast.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              PayFast
            </Link>
            . Your card details are handled entirely by PayFast — we never see or
            store them.
          </p>
        ),
      },
      {
        q: "Is there a discount for first-time customers?",
        a: (
          <p>
            Yes. Join the{" "}
            <span className="font-medium text-ink">Charmistry Club</span> and
            we&apos;ll email you a single-use code for{" "}
            <span className="font-medium text-ink">10% off your first order</span>
            . Apply it in the discount field at checkout.
          </p>
        ),
      },
    ],
  },
  {
    category: "Returns & Exchanges",
    items: [
      {
        q: "What is your returns policy?",
        a: (
          <>
            <p>
              For hygiene reasons we only accept returns on{" "}
              <span className="font-medium text-ink">
                faulty, damaged or incorrect items
              </span>{" "}
              — not for change of mind, incorrect sizing, or normal wear and
              tear.
            </p>
            <p>
              If something arrives wrong or damaged, email{" "}
              <a href="mailto:charmistryza@gmail.com" className={linkClass}>
                charmistryza@gmail.com
              </a>{" "}
              within{" "}
              <span className="font-medium text-ink">7 days of delivery</span>.
              Full details live on our{" "}
              <Link href="/shipping" className={linkClass}>
                Shipping &amp; Returns
              </Link>{" "}
              page.
            </p>
          </>
        ),
      },
    ],
  },
  {
    category: "Materials & Care",
    items: [
      {
        q: "What is the jewellery made from?",
        a: (
          <p>
            Most Charmistry pieces are crafted from{" "}
            <span className="font-medium text-ink">stainless steel</span>, chosen
            for its durability and everyday wearability.
          </p>
        ),
      },
      {
        q: "Is it waterproof and tarnish-resistant?",
        a: (
          <p>
            Many pieces are{" "}
            <span className="font-medium text-ink">
              water-resistant and tarnish-resistant
            </span>{" "}
            and hold up beautifully to daily wear. A little care still goes a long
            way in keeping them looking their best.
          </p>
        ),
      },
      {
        q: "How should I care for my pieces?",
        a: (
          <p>
            Avoid harsh chemicals and perfumes, store your pieces somewhere dry,
            and clean them gently with a soft cloth. See the full{" "}
            <Link href="/care" className={linkClass}>
              Jewellery Care Guide
            </Link>{" "}
            for more.
          </p>
        ),
      },
    ],
  },
];

// Flatten for global numbering; tag the first item of each group with its label.
const flatFaqs = faqGroups.flatMap((group) =>
  group.items.map((item, idx) => ({
    ...item,
    category: idx === 0 ? group.category : null,
  })),
);

const pills = [
  "Shipping from R49",
  "Free over R600",
  "Tracked delivery",
  "Secure payments",
];

export default function FAQ() {
  const reduce = useReducedMotion();
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <Navbar />
      <section className="bg-paper relative py-16 md:py-24 overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 md:px-10 lg:px-16">
          {/* Hero */}
          <div className="border-b border-ink/10 pb-10 mb-12">
            <motion.div
              className="flex items-center gap-4 mb-5"
              initial={reduce ? false : { opacity: 0 }}
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
                Support
              </span>
            </motion.div>

            <motion.h1
              className="text-ink uppercase leading-[1.08] mb-5"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(2rem, 5vw, 3.4rem)",
                letterSpacing: "0.02em",
              }}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
            >
              Frequently
              <br />
              Asked Questions
            </motion.h1>

            <motion.p
              className="text-ink/55 max-w-xl"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                lineHeight: "1.85",
                letterSpacing: "0.02em",
              }}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
            >
              Everything you need to know about ordering, delivery, and caring for
              your Charmistry pieces. Can&apos;t find an answer?{" "}
              <a href="mailto:charmistryza@gmail.com" className={linkClass}>
                Get in touch.
              </a>
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-2 mt-6"
              initial={reduce ? false : { opacity: 0 }}
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

          {/* Accordion */}
          <div className="flex flex-col">
            {flatFaqs.map((faq, i) => {
              const num = String(i + 1).padStart(2, "0");
              const isOpen = openKeys.has(num);
              return (
                <motion.div
                  key={num}
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  {faq.category && (
                    <div className={`flex items-center gap-4 mb-1 ${i === 0 ? "" : "mt-12"}`}>
                      <span
                        className="text-ink/40 uppercase shrink-0"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "10px",
                          letterSpacing: "0.28em",
                        }}
                      >
                        {faq.category}
                      </span>
                      <span className="h-px flex-1 bg-ink/10" />
                    </div>
                  )}

                  <div className="border-b border-ink/10">
                    <button
                      type="button"
                      id={`faq-trigger-${num}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${num}`}
                      onClick={() => toggle(num)}
                      className="group w-full flex items-start gap-4 md:gap-6 py-6 text-left cursor-pointer"
                    >
                      <span
                        className={`shrink-0 pt-[7px] tabular-nums transition-colors duration-300 ${
                          isOpen ? "text-gold" : "text-ink/35 group-hover:text-ink/60"
                        }`}
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "11px",
                          letterSpacing: "0.2em",
                          minWidth: "24px",
                        }}
                      >
                        {num}
                      </span>

                      <span
                        className={`flex-1 leading-snug transition-colors duration-300 ${
                          isOpen ? "text-ink" : "text-ink/85 group-hover:text-ink"
                        }`}
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "clamp(1.1rem, 2.4vw, 1.45rem)",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {faq.q}
                      </span>

                      {/* Plus → minus indicator */}
                      <span className="relative mt-2 h-3 w-3 shrink-0">
                        <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-ink/50 transition-colors duration-300 group-hover:bg-ink" />
                        <motion.span
                          className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-ink/50 transition-colors duration-300 group-hover:bg-ink"
                          animate={{ rotate: isOpen ? 0 : 90 }}
                          transition={{ duration: reduce ? 0 : 0.3, ease: EASE }}
                        />
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="panel"
                          id={`faq-panel-${num}`}
                          role="region"
                          aria-labelledby={`faq-trigger-${num}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <div
                            className="pb-7 pl-10 md:pl-12 pr-6 text-ink/55 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_p]:leading-[1.85] [&_ul]:mt-2 [&_ul]:mb-3 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_li]:flex [&_li]:items-baseline [&_li]:gap-2 [&_li]:leading-[1.8] [&_li]:before:content-['—'] [&_li]:before:text-ink/25 [&_li]:before:shrink-0 [&_li]:before:text-[11px]"
                            style={{
                              fontFamily: "var(--font-body)",
                              fontSize: "13.5px",
                              letterSpacing: "0.02em",
                              fontWeight: 300,
                            }}
                          >
                            {faq.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Still curious — contact CTA */}
          <motion.div
            className="mt-14 border border-ink/12 rounded-2xl px-6 md:px-8 py-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <div>
              <p
                className="text-ink/40 uppercase mb-1.5"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.22em",
                }}
              >
                Still curious?
              </p>
              <p
                className="text-ink"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "1.2rem",
                  letterSpacing: "0.02em",
                }}
              >
                We&apos;re here to help.
              </p>
            </div>
            <a
              href="mailto:charmistryza@gmail.com"
              className="group inline-flex items-center gap-2.5 bg-ink text-paper px-7 py-3.5 text-[10px] tracking-[0.25em] uppercase font-body hover:bg-ink-secondary transition-colors cursor-pointer self-start sm:self-auto"
            >
              Email Us
              <svg
                className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </a>
          </motion.div>
        </div>
      </section>
      <Footer />
    </>
  );
}
