"use client";

import { useRef } from "react";
import ShipAndPay from "@/assets/images/shipandpay.webp";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";

const tags = [
  {
    label: "Nationwide Delivery",
    sub: "We deliver across South Africa",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="1" y="3" width="15" height="13" rx="1" />
        <path d="M16 8h4l3 5v4h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    label: "Free Delivery on Orders R800+",
    sub: "Complimentary shipping on qualifying orders",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
      </svg>
    ),
  },
  {
    label: "Secure Payments",
    sub: "Powered by YOCO — safe & encrypted",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
];

export default function ShippingPayments() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <section
      ref={sectionRef}
      className="bg-paper relative py-16 md:py-24 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: parallax image */}
          <div className="relative">
            <motion.div
              className="relative aspect-[3/4] overflow-hidden"
              style={{ y: imageY }}
            >
              <Image
                src={ShipAndPay}
                alt="Charmistry packaging"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/20 to-transparent" />
            </motion.div>
          </div>

          {/* Right: heading + tags */}
          <div className="flex flex-col justify-center">
            {/* Eyebrow rule */}
            <motion.div
              className="flex items-center gap-4 mb-6"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="h-px w-10 bg-ink/30" />
              <span
                className="text-ink/50 uppercase"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.25em",
                }}
              >
                Delivery &amp; Checkout
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h2
              className="text-ink uppercase leading-[1.08] mb-10"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(2rem, 4vw, 3.6rem)",
                letterSpacing: "0.02em",
              }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.7,
                delay: 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              Shipping
              <br />
              &amp; Payments
            </motion.h2>

            {/* Tags */}
            <div className="flex flex-col gap-4">
              {tags.map((tag, i) => (
                <motion.div
                  key={tag.label}
                  className="flex items-start gap-4 border border-ink/12 rounded-2xl px-6 py-5 group hover:border-ink/30 hover:shadow-[0_4px_24px_rgba(10,10,10,0.06)] transition-all duration-300"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.55,
                    delay: 0.2 + i * 0.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {/* Icon */}
                  <div className="text-ink/60 mt-0.5 shrink-0 group-hover:text-ink transition-colors duration-300">
                    {tag.icon}
                  </div>

                  {/* Text */}
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-ink uppercase"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "12px",
                        fontWeight: 500,
                        letterSpacing: "0.12em",
                      }}
                    >
                      {tag.label}
                    </span>
                    <span
                      className="text-ink/45"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "11px",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {tag.sub}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
