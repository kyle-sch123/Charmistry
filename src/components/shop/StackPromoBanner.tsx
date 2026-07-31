/**
 * The gold promo band shown under the shop filter bar when the browsed
 * category has an automatic stack discount attached (rings Stack & Save, or
 * Create Your Own Stack on necklaces/earrings/bracelets).
 *
 * Chrome only — every caller passes its own icon and copy, and that copy must
 * be driven off the stack config in lib/bundles so what's promised here can
 * never drift from what /api/checkout charges.
 */

import type { ReactNode } from "react";

export default function StackPromoBanner({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  /** Small-caps gold lead-in, e.g. "Stack & Save". */
  title: string;
  /** The rest of the sentence, following an em dash. */
  children: ReactNode;
}) {
  return (
    <div className="mt-6 flex items-center justify-center gap-3 border border-gold/40 bg-gold-muted px-5 py-3.5 text-center">
      {icon}
      <p
        className="text-ink"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          letterSpacing: "0.06em",
          lineHeight: 1.6,
        }}
      >
        <span className="uppercase tracking-[0.2em] text-gold-dark">
          {title}
        </span>
        {" — "}
        {children}
      </p>
    </div>
  );
}
