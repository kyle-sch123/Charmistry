/** Static content page — full Terms & Conditions. */

"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const sections = [
  {
    num: "01",
    title: "General Information",
    content: (
      <>
        <p>
          This website is operated by Charmistry. Throughout the site, the terms
          &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; refer to
          Charmistry.
        </p>
        <p>
          By using this website and/or purchasing from us, you agree to be bound
          by these Terms &amp; Conditions. We reserve the right to update,
          change or replace any part of these Terms &amp; Conditions at any time
          without prior notice.
        </p>
      </>
    ),
  },
  {
    num: "02",
    title: "Eligibility to Use the Website",
    content: (
      <>
        <p>By using this website, you confirm that:</p>
        <ul>
          <li>you are at least 18 years old; or</li>
          <li>
            you have permission from a parent or legal guardian to use this
            website and place orders.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "03",
    title: "Products & Product Information",
    content: (
      <>
        <p>
          We strive to display our products and product colours as accurately as
          possible. However, colours may vary slightly depending on your screen
          settings and device.
        </p>
        <p>
          Most Charmistry pieces are made from stainless steel and are designed
          for everyday wear. While many pieces are water-resistant and
          tarnish-resistant, proper care is still recommended to extend the
          lifespan of your jewellery.
        </p>
        <p>Product availability is subject to change without notice.</p>
      </>
    ),
  },
  {
    num: "04",
    title: "Pricing",
    content: (
      <>
        <p>
          All prices displayed on the website are listed in South African Rand
          (ZAR). We reserve the right to change pricing, product availability,
          promotions or product descriptions at any time without prior notice.
        </p>
      </>
    ),
  },
  {
    num: "05",
    title: "Payments",
    content: (
      <>
        <p>
          We currently accept secure online payments through{" "}
          <Link
            href="https://www.payfast.co.za"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 decoration-ink/30 hover:decoration-ink transition-all duration-200"
          >
            PayFast
          </Link>
          . Orders will only be processed and shipped once payment has been
          successfully received and confirmed.
        </p>
        <p>
          We reserve the right to cancel or refuse any order suspected of fraud,
          unauthorized activity or abuse.
        </p>
      </>
    ),
  },
  {
    num: "06",
    title: "Shipping & Delivery",
    content: (
      <>
        <p>
          We currently ship exclusively within South Africa using{" "}
          <Link
            href="https://thecourierguy.co.za"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 decoration-ink/30 hover:decoration-ink transition-all duration-200"
          >
            The Courier Guy
          </Link>
          .
        </p>
        <div className="border-l-2 border-ink/20 bg-ink/[0.03] rounded-r-lg px-5 py-4 my-2">
          <p className="!mb-0">
            Estimated delivery time:{" "}
            <span className="font-medium text-ink">2–5 business days.</span>{" "}
            Delivery times are estimates and may vary due to courier delays,
            public holidays or unforeseen circumstances.
          </p>
        </div>
        <p>
          Customers will receive a tracking number once their order has been
          dispatched. Charmistry is not responsible for delays caused by the
          courier once the parcel has been handed over for delivery.
        </p>
      </>
    ),
  },
  {
    num: "07",
    title: "Returns, Refunds & Exchanges",
    content: (
      <>
        <p>
          Due to hygiene reasons and the nature of jewellery products, we do not
          accept returns or exchanges for:
        </p>
        <ul>
          <li>change of mind</li>
          <li>incorrect sizing selected by the customer</li>
          <li>normal wear and tear</li>
        </ul>
        <p>
          However, if the wrong item was received, or the item arrives damaged
          or faulty, please contact us within{" "}
          <span className="font-medium text-ink">7 days of delivery</span> at{" "}
          <a
            href="mailto:charmistryza@gmail.com"
            className="underline underline-offset-4 decoration-ink/30 hover:decoration-ink transition-all duration-200"
          >
            charmistryza@gmail.com
          </a>
          .
        </p>
        <p>
          Customers may be required to provide photographs of the item and
          packaging for assessment. If approved, Charmistry will replace the
          item, provide store credit, or issue a refund. Return shipping costs
          for approved faulty or incorrect items will be covered by Charmistry.
        </p>
      </>
    ),
  },
  {
    num: "08",
    title: "Lost or Damaged Parcels",
    content: (
      <>
        <p>
          If your parcel is lost or damaged during delivery, please contact us
          as soon as possible so we can investigate the matter with the courier
          company.
        </p>
      </>
    ),
  },
  {
    num: "09",
    title: "Promotions & Discount Codes",
    content: (
      <>
        <p>Promotions, discount codes and free gift offers:</p>
        <ul>
          <li>cannot be combined unless stated otherwise</li>
          <li>are subject to stock availability</li>
          <li>may be changed or cancelled at any time without notice</li>
        </ul>
      </>
    ),
  },
  {
    num: "10",
    title: "Intellectual Property",
    content: (
      <>
        <p>
          All content on this website — including logos, branding, product
          images, graphics, text and designs — belongs to Charmistry and may not
          be copied, reproduced or used without written permission.
        </p>
      </>
    ),
  },
  {
    num: "11",
    title: "Limitation of Liability",
    content: (
      <>
        <p>
          Charmistry shall not be held liable for indirect or consequential
          damages, allergic reactions, misuse of products, or delays outside of
          our control. Customers are responsible for following jewellery care
          instructions provided.
        </p>
      </>
    ),
  },
  {
    num: "12",
    title: "Privacy",
    content: (
      <>
        <p>
          Personal information submitted through the website will only be used
          for processing orders, customer communication, and improving our
          services. We do not sell customer information to third parties.
        </p>
      </>
    ),
  },
  {
    num: "13",
    title: "Contact Information",
    content: (
      <>
        <p>
          For any questions regarding these Terms &amp; Conditions, please reach
          out:
        </p>
        <div className="mt-3 border border-ink/12 rounded-2xl px-6 py-5">
          <p
            className="!mb-1 !text-ink/40 uppercase"
            style={{ fontSize: "10px", letterSpacing: "0.22em" }}
          >
            Get in touch
          </p>
          <p
            className="!mb-1 !text-ink"
            style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem" }}
          >
            Charmistry
          </p>
          <a
            href="mailto:charmistryza@gmail.com"
            className="text-ink/60 hover:text-ink transition-colors duration-200 underline underline-offset-4 decoration-ink/20 hover:decoration-ink/50"
            style={{ fontSize: "13px" }}
          >
            charmistryza@gmail.com
          </a>
        </div>
      </>
    ),
  },
];

const pills = [
  "South Africa only",
  "Secure payments",
  "2–5 business days delivery",
  "Free shipping over R700",
];

export default function TermsAndConditions() {
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
                Terms &amp; Conditions
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
              Shipping, Returns
              <br />
              &amp; Policies
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
              Welcome to Charmistry. By accessing or using this website, you
              agree to the terms and conditions set out below. Please read them
              carefully before placing an order.
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
