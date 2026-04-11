"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import Logo from "@/components/icons/Logo";
import MobileMenu from "./MobileMenu";
import SearchOverlay from "@/components/search/SearchOverlay";
import { navLinks } from "@/data/navigation";
import { useCart, selectCartCount } from "@/stores/cart";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 80], [0, 1]);
  const atTop = useTransform(scrollY, [0, 80], [1, 0]);

  const openCart = useCart((s) => s.openCart);
  const cartCount = useCart(selectCartCount);
  const hasHydrated = useCart((s) => s.hasHydrated);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      <motion.header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          backgroundColor: useTransform(bgOpacity, (v) => `rgba(250,250,248,${v})`),
          borderBottomWidth: "1px",
          borderBottomColor: useTransform(bgOpacity, (v) => `rgba(10,10,10,${v * 0.08})`),
          backdropFilter: "blur(16px)",
        }}
      >
        <nav className="max-w-7xl mx-auto px-6 md:px-8 h-16 md:h-20 flex items-center justify-between">
          {/* Logo — white on hero, dark on scroll */}
          <motion.div style={{ color: useTransform(atTop, (v) => `rgba(${v > 0.5 ? "255,255,255" : "10,10,10"},1)`) }}>
            <Link href="/" aria-label="Charmistry home">
              <Logo />
            </Link>
          </motion.div>

          {/* Desktop nav */}
          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.href}>
                <motion.div
                  style={{
                    color: useTransform(atTop, (v) =>
                      `rgba(${v > 0.5 ? "255,255,255,0.75" : "10,10,10,0.65"})`,
                    ),
                  }}
                >
                  <Link
                    href={link.href}
                    className="text-sm tracking-[0.1em] uppercase font-body transition-colors duration-300"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              </li>
            ))}
          </ul>

          {/* Right side */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Search (desktop) */}
            <motion.button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex w-11 h-11 items-center justify-center transition-colors cursor-pointer"
              style={{ color: useTransform(atTop, (v) => `rgba(${v > 0.5 ? "255,255,255,0.6" : "10,10,10,0.5"})`) }}
              aria-label="Open search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </motion.button>

            {/* Search (mobile) */}
            <motion.button
              onClick={() => setSearchOpen(true)}
              className="md:hidden w-11 h-11 flex items-center justify-center cursor-pointer"
              style={{ color: useTransform(atTop, (v) => `rgba(${v > 0.5 ? "255,255,255,0.85" : "10,10,10,0.75"})`) }}
              aria-label="Open search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </motion.button>

            {/* Cart */}
            <motion.button
              onClick={openCart}
              className="relative w-11 h-11 flex items-center justify-center transition-colors cursor-pointer"
              style={{ color: useTransform(atTop, (v) => `rgba(${v > 0.5 ? "255,255,255,0.6" : "10,10,10,0.5"})`) }}
              aria-label={`Open cart${hasHydrated && cartCount > 0 ? `, ${cartCount} items` : ""}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              {hasHydrated && cartCount > 0 && (
                <span className="absolute top-1 right-1 min-w-5 h-5 px-1 bg-ink text-paper text-[10px] font-body font-semibold flex items-center justify-center rounded-full">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </motion.button>

            {/* Mobile hamburger */}
            <button
              className="md:hidden w-11 h-11 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <motion.span
                className="w-6 h-px block"
                style={{ backgroundColor: useTransform(atTop, (v) => `rgba(${v > 0.5 ? "255,255,255" : "10,10,10"},1)`) }}
              />
              <motion.span
                className="w-4 h-px block"
                style={{ backgroundColor: useTransform(atTop, (v) => `rgba(${v > 0.5 ? "255,255,255" : "10,10,10"},1)`) }}
              />
            </button>
          </div>
        </nav>
      </motion.header>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
