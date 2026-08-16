/**
 * ProductLightbox — fullscreen photo viewer for the PDP gallery, with zoom.
 *
 * Opens over the page when the shopper clicks the main gallery image. One
 * click/tap on the photo zooms in centred on the clicked point (moving the
 * pointer pans by shifting the transform origin — the classic boutique
 * hover-zoom, but explicit so it works on touch too); a second click zooms
 * back out. ←/→ and the edge arrows step through the gallery, Esc / the ×
 * / the backdrop close it. Images render object-contain at full resolution
 * (next/image is unoptimized on this host, so the original file's pixels are
 * what the zoom magnifies).
 *
 * Controlled by the parent: `openAt` is the gallery index to open on (null =
 * closed); onClose reports the last-viewed index so the gallery can stay in
 * sync with where the shopper ended up.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  images: string[];
  /** Alt-text stem, e.g. the product name. */
  alt: string;
  /** Gallery index to open on, or null when closed. */
  openAt: number | null;
  /** Called with the last-viewed index when the lightbox closes. */
  onClose: (lastIndex: number) => void;
}

const ZOOM_SCALE = 2.2;

export default function ProductLightbox({ images, alt, openAt, onClose }: Props) {
  const open = openAt !== null;
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const frameRef = useRef<HTMLDivElement>(null);

  // Adopt the requested start image whenever the lightbox (re)opens — the
  // render-phase "adjust state when props change" pattern, so no effect runs.
  const [prevOpenAt, setPrevOpenAt] = useState<number | null>(null);
  if (openAt !== prevOpenAt) {
    setPrevOpenAt(openAt);
    if (openAt !== null) {
      setIndex(openAt);
      setZoomed(false);
    }
  }

  const count = images.length;
  const step = (dir: -1 | 1) => {
    setZoomed(false);
    setIndex((cur) => (cur + dir + count) % count);
  };

  // Keyboard: Esc closes, arrows navigate. Bound only while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(index);
      else if (e.key === "ArrowLeft" && count > 1) step(-1);
      else if (e.key === "ArrowRight" && count > 1) step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, count]);

  // Body scroll lock while open (same pattern as the cart drawer).
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const originFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = frameRef.current?.getBoundingClientRect();
    // A collapsed rect would divide to NaN and invalidate transform-origin.
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 50, y: 50 };
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="lightbox"
          className="fixed inset-0 z-[70] flex flex-col bg-ink/95 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} — photo viewer`}
        >
          {/* Top bar: counter + close */}
          <div className="flex items-center justify-between px-5 py-4">
            <span className="font-body text-[11px] tracking-[0.2em] uppercase text-paper/60 tabular-nums">
              {count > 1 ? `${index + 1} / ${count}` : ""}
            </span>
            <button
              type="button"
              onClick={() => onClose(index)}
              aria-label="Close photo viewer"
              className="flex h-10 w-10 items-center justify-center text-paper/70 hover:text-paper transition-colors cursor-pointer"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {/* Stage */}
          <div className="relative flex-1 min-h-0 px-4 pb-4 md:px-16">
            <div
              ref={frameRef}
              className={`relative h-full w-full overflow-hidden ${
                zoomed ? "cursor-zoom-out" : "cursor-zoom-in"
              }`}
              onClick={(e) => {
                setOrigin(originFromEvent(e));
                setZoomed((z) => !z);
              }}
              onPointerMove={(e) => {
                if (zoomed) setOrigin(originFromEvent(e));
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={index}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {images[index] && (
                    <Image
                      src={images[index]}
                      alt={`${alt} — photo ${index + 1}`}
                      fill
                      className="object-contain select-none transition-transform duration-300 ease-out"
                      style={{
                        transform: zoomed ? `scale(${ZOOM_SCALE})` : "scale(1)",
                        transformOrigin: `${origin.x}% ${origin.y}%`,
                      }}
                      sizes="100vw"
                      draggable={false}
                      priority
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Edge arrows */}
            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                  className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-paper/60 hover:text-paper transition-colors cursor-pointer"
                >
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next photo"
                  className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-paper/60 hover:text-paper transition-colors cursor-pointer"
                >
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Hint */}
          <p className="pb-5 text-center font-body text-[10px] tracking-[0.2em] uppercase text-paper/40">
            {zoomed ? "Move to pan · click to zoom out" : "Click the photo to zoom"}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
