/**
 * PaymentIcons — the compact strip of accepted payment marks shown in the
 * cart drawer (under "Continue Shopping"). All checkout methods run through
 * PayFast; these badges communicate the wallet/card options it accepts.
 *
 * Deliberately quiet: monochrome ink-on-paper chips that sit inside the
 * drawer's editorial palette rather than full-colour brand marks shouting at
 * the bottom of the bag.
 */

const chipClass =
  "flex h-6 min-w-10 items-center justify-center rounded-[3px] border border-ink/15 bg-paper px-1.5 text-ink/70";

function VisaMark() {
  return (
    <span className={chipClass} aria-label="Visa" role="img">
      <svg viewBox="0 0 36 12" className="h-2.5 w-auto" aria-hidden>
        <text
          x="18"
          y="10"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="11"
          fontStyle="italic"
          fontWeight="bold"
          fill="currentColor"
        >
          VISA
        </text>
      </svg>
    </span>
  );
}

function MastercardMark() {
  return (
    <span className={chipClass} aria-label="Mastercard" role="img">
      <svg viewBox="0 0 24 14" className="h-3.5 w-auto" aria-hidden>
        <circle cx="9" cy="7" r="5.4" fill="currentColor" opacity="0.55" />
        <circle cx="15" cy="7" r="5.4" fill="currentColor" opacity="0.3" />
      </svg>
    </span>
  );
}

function ApplePayMark() {
  return (
    <span className={chipClass} aria-label="Apple Pay" role="img">
      <svg viewBox="0 0 34 14" className="h-3 w-auto" aria-hidden>
        {/* Apple glyph */}
        <path
          d="M7.3 3.6c.4-.5.7-1.2.6-1.9-.6 0-1.3.4-1.7.9-.4.4-.7 1.1-.6 1.8.7 0 1.3-.3 1.7-.8zm.6 1c-1 0-1.8.6-2.3.6-.5 0-1.2-.6-2-.6-1 0-2 .6-2.5 1.6-1.1 1.9-.3 4.7.8 6.2.5.8 1.1 1.6 1.9 1.6.8 0 1-.5 2-.5s1.2.5 2 .5 1.3-.8 1.8-1.5c.6-.9.8-1.7.8-1.8 0 0-1.6-.6-1.6-2.4 0-1.5 1.2-2.2 1.3-2.3-.7-1-1.8-1.4-2.2-1.4z"
          fill="currentColor"
          transform="translate(1 0) scale(0.9)"
        />
        <text
          x="14"
          y="11"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="9"
          fontWeight="600"
          fill="currentColor"
        >
          Pay
        </text>
      </svg>
    </span>
  );
}

function GooglePayMark() {
  return (
    <span className={chipClass} aria-label="Google Pay" role="img">
      <svg viewBox="0 0 34 14" className="h-3 w-auto" aria-hidden>
        <text
          x="2"
          y="11"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="11"
          fontWeight="600"
          fill="currentColor"
        >
          G
        </text>
        <text
          x="12"
          y="11"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="9"
          fontWeight="600"
          fill="currentColor"
        >
          Pay
        </text>
      </svg>
    </span>
  );
}

function EftMark() {
  return (
    <span className={chipClass} aria-label="Instant EFT" role="img">
      <span className="font-body text-[8px] font-semibold tracking-[0.08em]">
        EFT
      </span>
    </span>
  );
}

export default function PaymentIcons({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center gap-2 ${className}`}
      aria-label="Accepted payment methods"
    >
      <VisaMark />
      <MastercardMark />
      <ApplePayMark />
      <GooglePayMark />
      <EftMark />
    </div>
  );
}
