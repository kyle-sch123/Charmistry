/**
 * Star primitives for the review UI.
 *
 * <Stars> renders a read-only rating with fractional fill (a gold star clipped
 * over a faint base). <StarRatingInput> is the interactive 1–5 picker used in
 * the review form, with hover preview and keyboard support.
 *
 * The path is the same one the PDP header already uses (ProductDetail.tsx).
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const STAR_PATH =
  "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d={STAR_PATH} />
    </svg>
  );
}

interface StarsProps {
  /** Rating 0–5; fractional values partially fill the corresponding star. */
  value: number;
  className?: string;
  /** Tailwind size classes for each star (default w-4 h-4). */
  starClassName?: string;
}

/** Read-only star row with fractional fill. */
export function Stars({ value, className, starClassName = "w-4 h-4" }: StarsProps) {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <div
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${clamped} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, clamped - i));
        return (
          <span key={i} className={cn("relative inline-block", starClassName)}>
            <StarIcon className={cn("absolute inset-0 text-ink/15", starClassName)} />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <StarIcon className={cn("text-gold", starClassName)} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  starClassName?: string;
}

/** Interactive 1–5 picker with hover preview. */
export function StarRatingInput({
  value,
  onChange,
  disabled,
  starClassName = "w-7 h-7",
}: StarRatingInputProps) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          disabled={disabled}
          onMouseEnter={() => !disabled && setHover(star)}
          onMouseLeave={() => setHover(0)}
          onFocus={() => !disabled && setHover(star)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(star)}
          className={cn(
            "transition-transform",
            !disabled && "hover:scale-110 cursor-pointer",
            disabled && "cursor-not-allowed",
          )}
        >
          <StarIcon
            className={cn(
              starClassName,
              star <= active ? "text-gold" : "text-ink/15",
            )}
          />
        </button>
      ))}
    </div>
  );
}
