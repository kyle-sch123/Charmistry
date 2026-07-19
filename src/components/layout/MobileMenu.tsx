/**
 * Mobile menu — full-screen overlay opened by the hamburger in Navbar.
 * ESC closes it and body scroll is locked while open.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { navLinks, shopCategories } from "@/data/navigation";
import Logo from "@/components/icons/Logo";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileMenu({ open, onClose }: MobileMenuProps) {
  const [shopExpanded, setShopExpanded] = useState(false);

  // Reset subcategory state when the menu closes — adjust-during-render
  // (react.dev "You Might Not Need an Effect") instead of an effect, so the
  // reset happens in the same pass without a cascading re-render.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setShopExpanded(false);
  }

  // ESC closes the menu and body scroll locks while open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-0 z-[60] bg-obsidian flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between px-6 h-20">
            <Logo />
            <button
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center text-ivory cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 flex flex-col items-center justify-center gap-6">
            {navLinks.map((link, i) => (
              <motion.div
                key={link.href}
                className="flex flex-col items-center w-full"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
              >
                {link.href === "/shop" ? (
                  /* Shop: entire column is the toggle — perfectly centered */
                  <button
                    onClick={() => setShopExpanded((v) => !v)}
                    aria-expanded={shopExpanded}
                    className="flex flex-col items-center gap-2 group cursor-pointer"
                  >
                    <span className="font-display text-3xl sm:text-4xl text-ivory font-light tracking-wide group-hover:text-gold transition-colors py-1">
                      {link.label}
                    </span>

                    {/* Centered chevron — rotates when expanded */}
                    <motion.svg
                      className="w-5 h-5 text-smoke/75 group-hover:text-ivory transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      animate={{ rotate: shopExpanded ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
                    </motion.svg>
                  </button>
                ) : (
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className="font-display text-3xl sm:text-4xl text-ivory font-light tracking-wide hover:text-gold transition-colors py-1"
                  >
                    {link.label}
                  </Link>
                )}

                {/* Collapsible category list — includes All Pieces */}
                {link.href === "/shop" && (
                  <AnimatePresence initial={false}>
                    {shopExpanded && (
                      <motion.div
                        key="shop-cats"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden w-full flex flex-col items-center mt-2"
                      >
                        {shopCategories.map((cat, j) => (
                          <motion.div
                            key={cat.href}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: j * 0.04 }}
                            className="w-full flex justify-center"
                          >
                            <Link
                              href={cat.href}
                              onClick={onClose}
                              className="min-h-[44px] flex items-center px-6 text-[12px] tracking-[0.2em] uppercase font-body text-smoke/85 hover:text-ivory active:text-ivory transition-colors cursor-pointer"
                            >
                              {cat.label}
                            </Link>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.div>
            ))}

            {/* Account — the top bar only shows this icon on desktop, so the
                menu is the mobile entry point. */}
            <motion.div
              className="flex flex-col items-center w-full"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + navLinks.length * 0.08 }}
            >
              <Link
                href="/account"
                onClick={onClose}
                className="font-display text-3xl sm:text-4xl text-ivory font-light tracking-wide hover:text-gold transition-colors py-1"
              >
                Account
              </Link>
            </motion.div>
          </nav>

          <div className="px-6 pb-8 text-center">
            <p className="text-smoke text-xs tracking-[0.15em] uppercase font-body">
              Luxury Redefined
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
