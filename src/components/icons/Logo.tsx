/** Wordmark — text-only "Charmistry" rendered in the heading font. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-heading text-2xl tracking-[0.15em] uppercase ${className}`}
      style={{ color: "inherit" }}
    >
      Charmistry
    </span>
  );
}
