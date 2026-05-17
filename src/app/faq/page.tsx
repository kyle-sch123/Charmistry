"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const faqs = [
  {
    num: "01",
    question: "How long does delivery take?",
    answer: (
      <p>
        Delivery usually takes{" "}
        <span className="font-medium text-ink">2–5 business days</span> within
        South Africa.
      </p>
    ),
  },
  {
    num: "02",
    question: "Do you offer tracking?",
    answer: (
      <p>Yes. Tracking details are emailed once your order has been shipped.</p>
    ),
  },
  {
    num: "03",
    question: "Is the jewellery waterproof?",
    answer: (
      <p>
        Most pieces are made from stainless steel and are designed for everyday
        wear. Many items are water-resistant and tarnish-resistant.
      </p>
    ),
  },
  {
    num: "04",
    question: "Do you accept returns?",
    answer: (
      <p>
        We currently only accept returns for faulty, damaged or incorrect items.
      </p>
    ),
  },
  {
    num: "05",
    question: "What payment methods do you accept?",
    answer: (
      <p>
        Secure online payments are processed through{" "}
        <Link
          href="https://paystack.com/za"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 decoration-ink/30 hover:decoration-ink transition-all duration-200"
        >
          Paystack
        </Link>
        .
      </p>
    ),
  },
  {
    num: "06",
    question: "Do you ship internationally?",
    answer: <p>Currently, we only ship within South Africa.</p>,
  },
];

const pills = [
  "South Africa only",
  "2–5 business days",
  "Tracked delivery",
  "Secure payments",
];

export default function FAQ() {
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
                Support
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
              Frequently
              <br />
              Asked Questions
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
              Everything you need to know about ordering, delivery, and caring
              for your Charmistry pieces. Can&apos;t find an answer?{" "}
              <a
                href="mailto:chamristryza@gmail.com"
                className="underline underline-offset-4 decoration-ink/30 hover:decoration-ink transition-all duration-200"
              >
                Get in touch.
              </a>
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

          {/* FAQs */}
          <div className="flex flex-col">
            {faqs.map((faq, i) => (
              <motion.div
                key={faq.num}
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
                {/* Question */}
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
                    {faq.num}
                  </span>
                  <h2
                    className="text-ink uppercase leading-snug"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {faq.question}
                  </h2>
                </div>

                {/* Answer */}
                <div
                  className="pl-[38px] text-ink/55 [&_p]:mb-0 [&_p]:leading-[1.85]"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "13px",
                    letterSpacing: "0.02em",
                    fontWeight: 300,
                  }}
                >
                  {faq.answer}
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
