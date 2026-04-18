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
      { label: "Shipping & Returns", href: "#" },
      { label: "Ring Size Guide", href: "#" },
      { label: "Care Instructions", href: "#" },
      { label: "FAQ", href: "#" },
    ],
  },
  {
    heading: "Connect",
    links: [
      { label: "Instagram", href: "#" },
      { label: "TikTok", href: "#" },
      { label: "Pinterest", href: "#" },
      { label: "Contact Us", href: "#contact" },
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
  {
    label: "Pinterest",
    href: "#",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="bg-ink">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-14 md:py-18">
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
              Luxury Jewellery · Est. 2024
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

        {/* Bottom bar */}
        <div className="pt-7 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p
            className="text-paper/30 uppercase"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "9px",
              letterSpacing: "0.2em",
            }}
          >
            &copy; {new Date().getFullYear()} Charmistry. All rights reserved.
          </p>

          {/* Social icons */}
          <div className="flex items-center gap-5">
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="text-paper/35 hover:text-paper transition-colors duration-200 cursor-pointer"
              >
                {s.icon}
              </a>
            ))}
          </div>

          <div
            className="flex items-center gap-4 text-paper/30 uppercase"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "9px",
              letterSpacing: "0.2em",
            }}
          >
            <a
              href="#"
              className="hover:text-paper transition-colors duration-200 cursor-pointer"
            >
              Privacy
            </a>
            <span>&middot;</span>
            <a
              href="#"
              className="hover:text-paper transition-colors duration-200 cursor-pointer"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
