/**
 * Sticky add-to-bag bar for the product page, phones and tablets only.
 *
 * Why this exists: on a phone the inline quantity stepper and "Add to bag"
 * button sit well below the gallery, description and swatches, so a shopper who
 * has decided has to scroll back down to buy. This bar keeps both in reach at
 * the bottom of the screen whenever the inline row is out of view.
 *
 * The bar owns no purchase state. `ProductDetail` passes in `quantity`,
 * `justAdded` and `onAdd`, so the inline row and this bar are two views of the
 * same state: change the quantity in one and the other follows, and adding from
 * either fires the same tracking and flips both buttons to "Added to bag".
 *
 * It owns only its own visibility, which is three observed facts:
 *   - the inline CTA row is on screen (the bar would just duplicate it),
 *   - the site footer is on screen (the bar must never cover it),
 *   - a text field has focus (the on-screen keyboard is up, e.g. while writing
 *     a review).
 * It is also never shown for a sold-out variant; the inline row already says so.
 * All three flags are set from observer and listener callbacks, never during
 * render or synchronously in an effect body, and every observer and listener is
 * torn down in the effect cleanup.
 *
 * While hidden the bar is `inert` and `aria-hidden`, so it is neither focusable
 * nor announced. It is `lg:hidden`: from 1024px up the inline row is enough.
 */

"use client";

import { useEffect, useState, type RefObject } from "react";
import Image from "next/image";
import { formatPrice } from "@/lib/utils";
import { isTextEntryField } from "@/lib/text-entry";

interface StickyAddToBagProps {
  /** The inline CTA row. The bar hides while this is on screen. */
  watchRef: RefObject<HTMLElement | null>;
  name: string;
  /** Metal label for the selected variant, or null when there is none. */
  variantLabel: string | null;
  price: number;
  imageUrl: string | null;
  quantity: number;
  maxQty: number;
  /** ProductDetail's `disabled`: out of stock or no units left. */
  soldOut: boolean;
  justAdded: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  onAdd: () => void;
}

/**
 * The inline row counts as "in view" only above this much of the viewport's
 * bottom edge, which is the bar's height. A row sitting directly behind the bar
 * therefore does not count, and the bar stays up until the row is clear of it.
 */
const BAR_CLEARANCE = "0px 0px -72px 0px";

function isTextEntryElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return isTextEntryField(
    el.tagName,
    el instanceof HTMLInputElement ? el.type : null,
    el.isContentEditable,
  );
}

export default function StickyAddToBag({
  watchRef,
  name,
  variantLabel,
  price,
  imageUrl,
  quantity,
  maxQty,
  soldOut,
  justAdded,
  onDecrement,
  onIncrement,
  onAdd,
}: StickyAddToBagProps) {
  // Start "in view" so the bar does not flash on before the first observer
  // callback; on a phone the row is usually below the fold, so it slides in
  // just after first paint.
  const [ctaInView, setCtaInView] = useState(true);
  const [footerInView, setFooterInView] = useState(false);
  const [textFieldFocused, setTextFieldFocused] = useState(false);

  useEffect(() => {
    const target = watchRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        if (latest) setCtaInView(latest.isIntersecting);
      },
      { rootMargin: BAR_CLEARANCE, threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchRef]);

  useEffect(() => {
    // The site footer is the `main` element's next sibling. The generic
    // `footer` fallback keeps this working if that layout ever changes; the
    // cart drawer's own <footer> only exists while the drawer is open.
    const footer =
      document.querySelector("main ~ footer") ??
      document.querySelector("footer");
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        if (latest) setFooterInView(latest.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) =>
      setTextFieldFocused(isTextEntryElement(e.target));
    // `relatedTarget` is where focus is going, so tabbing from one field to
    // the next does not blink the bar back in between.
    const onFocusOut = (e: FocusEvent) =>
      setTextFieldFocused(isTextEntryElement(e.relatedTarget));
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const visible = !ctaInView && !footerInView && !textFieldFocused && !soldOut;

  return (
    <div
      role="region"
      aria-label="Add to bag"
      inert={!visible}
      aria-hidden={visible ? undefined : true}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ease-out lg:hidden ${
        visible ? "translate-y-0" : "translate-y-full pointer-events-none"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-8">
        {/* Tablet only: a thumbnail and the name, so the bar still says what
            is about to be added once the product is out of view. */}
        <div className="relative hidden h-12 w-10 shrink-0 overflow-hidden bg-stone md:block">
          {imageUrl && (
            <Image src={imageUrl} alt="" fill sizes="40px" className="object-cover" />
          )}
        </div>
        <div className="hidden min-w-0 flex-1 flex-col md:flex">
          <p className="truncate font-display text-base leading-tight">{name}</p>
          <p className="text-xs text-ink-secondary">
            {variantLabel ? `${variantLabel} · ${formatPrice(price)}` : formatPrice(price)}
          </p>
        </div>

        <div className="flex shrink-0 items-center border border-ink/15">
          <button
            type="button"
            onClick={onDecrement}
            className="flex size-11 items-center justify-center text-ink/70 hover:text-ink cursor-pointer disabled:opacity-30"
            disabled={quantity <= 1 || soldOut}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-8 text-center font-body tabular-nums">
            {quantity}
          </span>
          <button
            type="button"
            onClick={onIncrement}
            className="flex size-11 items-center justify-center text-ink/70 hover:text-ink cursor-pointer disabled:opacity-30"
            disabled={soldOut || quantity >= maxQty}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="h-11 flex-1 bg-ink text-paper text-xs tracking-[0.15em] uppercase font-body hover:bg-ink-secondary transition-colors cursor-pointer md:w-56 md:flex-none"
        >
          {justAdded ? (
            "Added to bag ✓"
          ) : (
            <>
              Add to bag
              <span className="hidden min-[360px]:inline">
                {" "}
                · {formatPrice(price)}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
