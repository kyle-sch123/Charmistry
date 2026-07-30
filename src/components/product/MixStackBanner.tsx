/**
 * MixStackBanner — the "Create Your Own Stack" incentive shown on necklace,
 * earring and bracelet product pages, just beneath the add-to-bag button.
 *
 * The sibling of RingsStackBanner: same compact gold band, but instead of
 * linking out to a collection it anchors down to the StackBuilder module on
 * the same page (id="stack-builder"), where the shopper can assemble the trio
 * in place. Copy is driven off MIX_MATCH_STACK (the same object /api/checkout
 * charges) so the promise shown here can never drift from the discount
 * actually applied.
 */

import { MIX_MATCH_STACK } from "@/lib/bundles";

export default function MixStackBanner() {
  return (
    <a
      href="#stack-builder"
      className="group mt-8 flex items-center gap-3.5 border border-gold/40 bg-gold-muted px-4 py-3.5 transition-colors duration-300 hover:border-gold/70 hover:bg-gold/25 cursor-pointer"
      aria-label={`Create your own stack: pair a necklace, earrings and a bracelet for ${MIX_MATCH_STACK.percentOff}% off. Jump to the stack builder.`}
    >
      {/* Trio of linked pieces */}
      <svg
        className="w-6 h-6 shrink-0 text-gold-dark"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        aria-hidden
      >
        <circle cx="8" cy="9" r="4.2" />
        <circle cx="16" cy="9" r="4.2" />
        <circle cx="12" cy="15.5" r="4.2" />
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
          Create Your Own Stack
        </span>
        {" — "}Pair a necklace, earrings &amp; a bracelet for{" "}
        <span className="font-medium">{MIX_MATCH_STACK.percentOff}% off</span>,
        applied automatically at checkout.
      </p>

      <svg
        className="w-4 h-4 shrink-0 text-gold-dark transition-transform duration-300 group-hover:translate-y-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </a>
  );
}
