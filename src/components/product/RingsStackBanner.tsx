/**
 * RingsStackBanner — the "Stack & Save" incentive shown on ring product pages,
 * just beneath the add-to-bag button.
 *
 * A compact gold band mirroring the /shop rings promo: add enough rings and a
 * percentage comes off automatically at checkout. Copy is driven off the
 * RINGS_STACK config (the same object /api/checkout charges) so the promise
 * shown here can never drift from the discount actually applied. The whole band
 * links through to the rings collection so a shopper can act on it in one tap.
 */

import Link from "next/link";
import { RINGS_STACK } from "@/lib/bundles";

export default function RingsStackBanner() {
  return (
    <Link
      href={`/shop?category=${RINGS_STACK.category}`}
      className="group mt-8 flex items-center gap-3.5 border border-gold/40 bg-gold-muted px-4 py-3.5 transition-colors duration-300 hover:border-gold/70 hover:bg-gold/25 cursor-pointer"
      aria-label={`Stack & Save: add any ${RINGS_STACK.minQuantity} rings for ${RINGS_STACK.percentOff}% off. Shop the rings collection.`}
    >
      {/* Stacked rings */}
      <svg
        className="w-6 h-6 shrink-0 text-gold-dark"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        aria-hidden
      >
        <ellipse cx="12" cy="7" rx="6.5" ry="2.3" />
        <ellipse cx="12" cy="12" rx="6.5" ry="2.3" />
        <ellipse cx="12" cy="17" rx="6.5" ry="2.3" />
      </svg>

      <p
        className="flex-1 text-ink"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          letterSpacing: "0.02em",
          lineHeight: 1.55,
        }}
      >
        <span className="uppercase tracking-[0.18em] text-gold-dark">
          Stack &amp; Save
        </span>
        {" — "}Add any {RINGS_STACK.minQuantity} rings for{" "}
        <span className="font-medium">{RINGS_STACK.percentOff}% off</span>,
        applied automatically at checkout.
      </p>

      <svg
        className="w-4 h-4 shrink-0 text-gold-dark transition-transform duration-300 group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
