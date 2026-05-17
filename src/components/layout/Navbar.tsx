"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Logo from "@/components/icons/Logo";
import MobileMenu from "./MobileMenu";
import SearchOverlay from "@/components/search/SearchOverlay";
import { navLinks, shopCategories } from "@/data/navigation";
import { useCart, selectCartCount } from "@/stores/cart";

interface NavbarProps {
  /**
   * When true, the navbar starts transparent with white text (for pages
   * that open on a dark full-bleed hero, e.g. the home page) and transitions
   * to the solid paper background on scroll. When false, the navbar is
   * always solid — correct default for shop/PDP/content pages.
   */
  overHero?: boolean;
}

export default function Navbar({ overHero = false }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 80], overHero ? [0, 1] : [1, 1]);
  const atTop = useTransform(scrollY, [0, 80], overHero ? [1, 0] : [0, 0]);

  const openCart = useCart((s) => s.openCart);
  const cartCount = useCart(selectCartCount);
  const hasHydrated = useCart((s) => s.hasHydrated);

  const headerBg = useTransform(bgOpacity, (v) => `rgba(250,250,248,${v})`);
  const headerBorder = useTransform(bgOpacity, (v) => `rgba(10,10,10,${v * 0.08})`);
  const logoColor = useTransform(atTop, (v) => `rgba(${v > 0.5 ? "255,255,255" : "10,10,10"},1)`);
  const linkColor = useTransform(atTop, (v) =>
    `rgba(${v > 0.5 ? "255,255,255,0.75" : "10,10,10,0.65"})`,
  );
  const iconColor = useTransform(atTop, (v) => `rgba(${v > 0.5 ? "255,255,255,0.6" : "10,10,10,0.5"})`);
  const mobileIconColor = useTransform(atTop, (v) => `rgba(${v > 0.5 ? "255,255,255,0.85" : "10,10,10,0.75"})`);
  const barColor = useTransform(atTop, (v) => `rgba(${v > 0.5 ? "255,255,255" : "10,10,10"},1)`);

  const openShop = () => {
    clearTimeout(closeTimer.current);
    setShopOpen(true);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setShopOpen(false), 150);
  };

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Clean up timeout on unmount
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <>
      <motion.header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          backgroundColor: headerBg,
          borderBottomWidth: "1px",
          borderBottomColor: headerBorder,
          backdropFilter: "blur(16px)",
        }}
      >
        <nav className="max-w-7xl mx-auto px-6 md:px-8 h-16 md:h-20 flex items-center justify-between">
          {/* Logo */}
          <motion.div style={{ color: logoColor }}>
            <Link href="/" aria-label="Charmistry home">
              <Logo />
            </Link>
          </motion.div>

          {/* Desktop nav */}
          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              if (link.href === "/shop") {
                return (
                  <li
                    key={link.href}
                    className="relative"
                    onMouseEnter={openShop}
                    onMouseLeave={scheduleClose}
                  >
                    <motion.div style={{ color: linkColor }}>
                      <Link
                        href={link.href}
                        className="text-sm tracking-[0.1em] uppercase font-body transition-colors duration-300"
                      >
                        {link.label}
                      </Link>
                    </motion.div>

                    {/* Vertical dropdown anchored under "Shop" */}
                    <AnimatePresence>
                      {shopOpen && (
                        <motion.div
                          onMouseEnter={openShop}
                          onMouseLeave={scheduleClose}
                          className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-44 bg-paper border border-ink/10 shadow-lg py-2"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                          {shopCategories.map((cat) => (
                            <Link
                              key={cat.href}
                              href={cat.href}
                              onClick={() => setShopOpen(false)}
                              className="block px-5 py-2.5 text-[11px] tracking-[0.18em] uppercase font-body text-ink/55 hover:text-ink hover:bg-ink/[0.03] transition-colors duration-150 cursor-pointer"
                            >
                              {cat.label}
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              }
              return (
                <li key={link.href}>
                  <motion.div style={{ color: linkColor }}>
                    <Link
                      href={link.href}
                      className="text-sm tracking-[0.1em] uppercase font-body transition-colors duration-300"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                </li>
              );
            })}
          </ul>

          {/* Right side */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Search (desktop) */}
            <motion.button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex w-11 h-11 items-center justify-center transition-colors cursor-pointer"
              style={{ color: iconColor }}
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
              style={{ color: mobileIconColor }}
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
              style={{ color: iconColor }}
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
              <motion.span className="w-6 h-px block" style={{ backgroundColor: barColor }} />
              <motion.span className="w-4 h-px block" style={{ backgroundColor: barColor }} />
            </button>
          </div>
        </nav>

      </motion.header>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
