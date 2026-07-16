/**
 * Heart toggle for saving a product to the wishlist.
 *
 * Variants:
 *   overlay — frosted circle for product-card image corners. Must sit
 *             OUTSIDE ProductCard's 3D-tilt subtree (same hit-testing caveat
 *             as the card's overlay link) with z-10 + pointer-events-auto,
 *             and stops propagation so the whole-card link doesn't navigate.
 *   inline  — bordered square matching the PDP's 48px control row.
 *
 * Signed-out clicks route to /login?next=<current page>. Hearts render
 * un-filled until the store has loaded (initial client state matches the
 * server render, so there's no hydration mismatch — mirrors the cart badge).
 */

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useWishlist } from "@/stores/wishlist";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  productId: string;
  variant?: "overlay" | "inline";
  className?: string;
}

export default function WishlistButton({
  productId,
  variant = "overlay",
  className,
}: WishlistButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const active = useWishlist((s) => s.ids.has(productId));
  const toggle = useWishlist((s) => s.toggle);

  useEffect(() => {
    void useWishlist.getState().load();
  }, []);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const result = await toggle(productId);
    if (result === "unauthenticated") {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? "Remove from wishlist" : "Save to wishlist"}
      className={cn(
        "pointer-events-auto z-10 flex items-center justify-center cursor-pointer transition-colors",
        variant === "overlay" &&
          "w-9 h-9 min-w-[36px] rounded-full bg-paper/85 backdrop-blur-sm text-ink hover:bg-paper",
        variant === "inline" &&
          "w-12 border border-ink/15 text-ink hover:border-ink",
        className,
      )}
    >
      <motion.svg
        key={active ? "filled" : "outline"}
        initial={{ scale: 0.7 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.6c0 5.2-7.2 9.9-8.7 10.8a.6.6 0 0 1-.6 0C10.2 18.5 3 13.8 3 8.6a4.9 4.9 0 0 1 9-2.7A4.9 4.9 0 0 1 21 8.6Z"
        />
      </motion.svg>
    </button>
  );
}
