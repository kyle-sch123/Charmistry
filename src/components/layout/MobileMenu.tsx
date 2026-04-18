"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { navLinks, shopCategories } from "@/data/navigation";
import Logo from "@/components/icons/Logo";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileMenu({ open, onClose }: MobileMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
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
                className="flex flex-col items-center gap-3"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
              >
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="font-display text-3xl sm:text-4xl text-ivory font-light tracking-wide hover:text-gold transition-colors py-1"
                >
                  {link.label}
                </Link>

                {/* Category sub-links for Shop */}
                {link.href === "/shop" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.35 }}
                    className="flex flex-wrap justify-center gap-x-5 gap-y-1.5"
                  >
                    {shopCategories.slice(1).map((cat) => (
                      <Link
                        key={cat.href}
                        href={cat.href}
                        onClick={onClose}
                        className="text-[10px] tracking-[0.22em] uppercase font-body text-smoke/60 hover:text-ivory transition-colors cursor-pointer"
                      >
                        {cat.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            ))}
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
