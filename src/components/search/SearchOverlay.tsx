/**
 * Full-screen product search overlay opened from the Navbar.
 *
 * Search runs against searchProducts() (ilike on name + description) with
 * a 220ms debounce. A `cancelled` flag prevents stale fetches from
 * overwriting newer results — important because the user can type faster
 * than Supabase returns.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { ProductWithCategory } from "@/types";
import { searchProducts } from "@/lib/queries";
import { formatPrice } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ open, onClose }: Props) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProductWithCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive runtime visibility from term length rather than resetting state
  // inside an effect — keeps us out of the React "set-state-in-effect" rule.
  const trimmedTerm = term.trim();
  const shouldSearch = open && trimmedTerm.length >= 2;
  const displayResults = shouldSearch ? results : [];
  const displayLoading = shouldSearch ? loading : false;
  const displayError = shouldSearch ? error : null;

  // Focus input + lock scroll on open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = original;
      clearTimeout(t);
    };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounced search. setState is intentionally only called from inside the
  // async timeout callback (not in the effect body) — the React rule
  // forbids the latter, and moving the setLoading/setError into the
  // setTimeout cleanly satisfies it.
  useEffect(() => {
    if (!shouldSearch) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const data = await searchProducts(trimmedTerm, 8);
        if (!cancelled) setResults(data);
      } catch (err) {
        if (!cancelled) {
          setError("Something went wrong. Please try again.");
          setResults([]);
          console.error(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmedTerm, shouldSearch]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="search-root"
          className="fixed inset-0 z-[70] bg-paper text-ink flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-label="Search products"
        >
          <div className="max-w-4xl mx-auto w-full px-6 md:px-8 pt-8">
            <div className="flex items-center justify-between mb-10">
              <p className="text-[11px] tracking-[0.25em] uppercase text-ink/55 font-body">
                Search
              </p>
              <button
                onClick={onClose}
                className="text-[11px] tracking-[0.2em] uppercase text-ink/60 hover:text-ink transition-colors flex items-center gap-2 cursor-pointer"
                aria-label="Close search"
              >
                Close
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="relative border-b border-ink/20">
              <svg
                className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 text-ink/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={inputRef}
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search for rings, necklaces, charms…"
                className="w-full pl-10 pr-4 py-5 bg-transparent font-display text-2xl md:text-3xl font-light placeholder:text-ink/30 focus:outline-none"
                aria-label="Search term"
              />
            </div>

            <div className="mt-10 flex-1 overflow-y-auto pb-20">
              {!shouldSearch && (
                <p className="text-sm text-ink/50">
                  Start typing to search the collection.
                </p>
              )}

              {shouldSearch && displayLoading && (
                <p className="text-sm text-ink/50">Searching…</p>
              )}

              {displayError && !displayLoading && (
                <p className="text-sm text-ink/60">{displayError}</p>
              )}

              {!displayLoading && !displayError && shouldSearch && displayResults.length === 0 && (
                <p className="text-sm text-ink/60">
                  No results for &ldquo;{term}&rdquo;. Try a different word.
                </p>
              )}

              {!displayLoading && displayResults.length > 0 && (
                <ul className="divide-y divide-ink/10">
                  {displayResults.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/products/${p.slug}`}
                        onClick={onClose}
                        className="flex items-center gap-5 py-4 group"
                      >
                        <div className="relative w-16 h-16 shrink-0 overflow-hidden bg-stone">
                          {p.image_url && (
                            <Image
                              src={p.image_url}
                              alt={p.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-500"
                              sizes="64px"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] tracking-[0.2em] uppercase text-ink/50 font-body">
                            {p.categories?.name ?? "Charmistry"}
                          </p>
                          <p className="font-display text-lg text-ink truncate">
                            {p.name}
                          </p>
                        </div>
                        <span className="font-body text-sm text-ink shrink-0">
                          {formatPrice(p.price)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
