"use client";

import Link from "next/link";

const NAV_COLS = [
  {
    heading: "Shop",
    links: [
      { label: "Rings", href: "/shop?category=rings" },
      { label: "Necklaces", href: "/shop?category=necklaces" },
      { label: "Earrings", href: "/shop?category=earrings" },
      { label: "Bracelets", href: "/shop?category=bracelets" },
      { label: "Jewellery Boxes", href: "/shop?category=jewellery-boxes" },
    ],
  },
  {
    heading: "Customer Care",
    links: [
      { label: "Shipping & Returns", href: "/shipping" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Care Instructions", href: "/care" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    heading: "Connect",
    links: [
      { label: "Instagram", href: "https://www.instagram.com/charmistry_za" },
      { label: "TikTok", href: "https://www.tiktok.com/@charmistry_za" },
      { label: "Contact Us", href: "mailto:charmistryza@gmail.com" },
    ],
  },
];

const SOCIAL = [
  {
    label: "Instagram",
    href: "#",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "#",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="bg-ink">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-12 md:py-13">
        {/* Top: wordmark + nav columns */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 lg:gap-20 pb-10 border-b border-paper/10">
          {/* Wordmark */}
          <div>
            <h2
              className="text-paper leading-none mb-3"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(1.8rem, 3.5vw, 3rem)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Charmistry
            </h2>
            <p
              className="text-paper/40 uppercase"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "10px",
                letterSpacing: "0.3em",
              }}
            >
              Jewellery designed to last · Est. 2025
            </p>
          </div>

          {/* Nav columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 md:gap-14">
            {NAV_COLS.map((col) => (
              <div key={col.heading}>
                <p
                  className="text-paper/35 uppercase mb-5"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "9px",
                    letterSpacing: "0.28em",
                  }}
                >
                  {col.heading}
                </p>
                <ul className="flex flex-col gap-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-paper/55 hover:text-paper transition-colors duration-200 cursor-pointer"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "12px",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
