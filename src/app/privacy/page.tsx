"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const sections = [
  // — Refunds & Returns —
  {
    num: "01",
    title: "Returns",
    content: (
      <>
        <p>We currently do not accept returns or exchanges for:</p>
        <ul>
          <li>change of mind;</li>
          <li>incorrect sizing selected by the customer; or</li>
          <li>normal wear and tear.</li>
        </ul>
      </>
    ),
  },
  {
    num: "02",
    title: "Faulty or Incorrect Items",
    content: (
      <>
        <p>If your item arrives:</p>
        <ul>
          <li>faulty;</li>
          <li>damaged; or</li>
          <li>incorrect,</li>
        </ul>
        <p>
          please email us within{" "}
          <span className="font-medium text-ink">7 days of delivery</span> at{" "}
          <a
            href="mailto:chamristryza@gmail.com"
            className="underline underline-offset-4 decoration-ink/30 hover:decoration-ink transition-all duration-200"
          >
            chamristryza@gmail.com
          </a>
          .
        </p>
        <p>Include:</p>
        <ul>
          <li>your order number;</li>
          <li>clear photos of the item; and</li>
          <li>a description of the issue.</li>
        </ul>
        <p>If approved, we will offer:</p>
        <ul>
          <li>a replacement;</li>
          <li>store credit; or</li>
          <li>a refund.</li>
        </ul>
      </>
    ),
  },
  {
    num: "03",
    title: "Refund Processing",
    content: (
      <>
        <p>
          Approved refunds will be processed back to the original payment method
          used during checkout.
        </p>
        <p>
          Processing times may vary depending on your bank or payment provider.
        </p>
      </>
    ),
  },
  // — Privacy —
  {
    num: "04",
    title: "Information We Collect",
    content: (
      <>
        <p>We may collect:</p>
        <ul>
          <li>name;</li>
          <li>email address;</li>
          <li>shipping address;</li>
          <li>phone number; and</li>
          <li>payment information.</li>
        </ul>
        <p>
          Payment details are securely processed through third-party payment
          providers.
        </p>
      </>
    ),
  },
  {
    num: "05",
    title: "How We Use Your Information",
    content: (
      <>
        <p>We use customer information to:</p>
        <ul>
          <li>process orders;</li>
          <li>provide customer support;</li>
          <li>send order updates; and</li>
          <li>improve our services.</li>
        </ul>
      </>
    ),
  },
  {
    num: "06",
    title: "Third-Party Services",
    content: (
      <>
        <p>We may use trusted third-party services for:</p>
        <ul>
          <li>payment processing;</li>
          <li>shipping; and</li>
          <li>website analytics.</li>
        </ul>
      </>
    ),
  },
];

const divider = 3; // sections before this index belong to Refunds, after to Privacy

const pills = [
  "7-day faulty item window",
  "Original payment method",
  "Data not sold to third parties",
  "Secure payment processing",
];

export default function RefundAndPrivacyPolicy() {
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
                Policy
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
              Refunds, Returns
              <br />
              &amp; Privacy
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
              This page outlines our returns and refund policy as well as how we
              handle your personal information. Please read carefully before
              making a purchase.
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
              <>
                {/* Privacy sub-heading divider */}
                {i === divider && (
                  <motion.div
                    key="privacy-divider"
                    className="flex items-center gap-4 pt-4 pb-2 mt-4"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="h-px w-8 bg-ink/30" />
                    <span
                      className="text-ink/40 uppercase"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "10px",
                        letterSpacing: "0.25em",
                      }}
                    >
                      Privacy &amp; Data
                    </span>
                  </motion.div>
                )}

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
              </>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
