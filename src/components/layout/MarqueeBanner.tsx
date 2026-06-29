/**
 * Promotional marquee strip — a fixed-height dark bar that scrolls the brand's
 * key selling points in a seamless loop. Used inline under the hero on the home
 * page, and pinned beneath the nav row on every other page (rendered inside
 * Navbar when not in over-hero mode).
 *
 * The loop works by laying out the phrase sequence twice and translating the
 * track by -50%; because the two halves are identical, the wrap is invisible.
 * The strip keeps a fixed height (h-9 / md:h-10) so the spacer the navbar
 * renders to compensate for it can match exactly.
 */

const PHRASES = [
  "Free Shipping Over R600",
  "Live in it: Waterproof + Tarnish-Resistant",
  "R80 Nationwide Shipping",
];

// Repeat the phrases so a single sequence is wide enough to fill ultrawide
// viewports without a gap before the duplicate scrolls in.
const SEQUENCE = Array.from({ length: 4 }, () => PHRASES).flat();

function Sequence({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <ul
      className="flex shrink-0 items-center"
      aria-hidden={ariaHidden || undefined}
    >
      {SEQUENCE.map((phrase, i) => (
        <li key={i} className="flex items-center">
          <span className="font-body text-[10px] md:text-[11px] tracking-[0.28em] uppercase whitespace-nowrap">
            {phrase}
          </span>
          <span
            className="mx-6 md:mx-9 text-[7px] text-gold/70 select-none"
            aria-hidden
          >
            ◆
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function MarqueeBanner({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`group relative flex h-9 md:h-10 items-center overflow-hidden bg-[#2c3035] text-paper/90 ${className}`}
    >
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        <Sequence />
        <Sequence ariaHidden />
      </div>
    </div>
  );
}
