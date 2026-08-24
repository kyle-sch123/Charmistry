/**
 * A plain <img> with a real srcset — deliberately NOT next/image.
 *
 * next.config sets `images.unoptimized: true` (Cloudflare Pages doesn't run
 * Next's optimizer), which makes <Image> emit one full-size src and no srcset.
 * On this page that would push a 2400px file to a 375px phone for every shot.
 * The width ladder is instead pre-rendered at upload time and declared in
 * lib/daily-affair.ts, so the browser picks the right rung — a phone pulls the
 * 640px variant (4–39 kB) where it would otherwise have pulled 250 kB.
 *
 * Always renders into a positioned, aspect-ratio'd parent: the element is
 * absolutely filled, so the parent reserves the space and nothing shifts as
 * images land.
 */

import {
  affairFallbackSrc,
  affairSrcSet,
  type AffairAsset,
} from "@/lib/daily-affair";

interface AffairImageProps {
  asset: AffairAsset;
  /** Layout width of the slot at each breakpoint — drives which rung loads. */
  sizes: string;
  /** Above the fold: skip lazy loading and hint the preload scanner. */
  priority?: boolean;
  className?: string;
  /** Override the alt from the asset (e.g. when a caption already names it). */
  alt?: string;
  /**
   * "cover" fills the slot and crops; "contain" shows the whole frame on the
   * slot's background. An explicit prop rather than a `object-contain` override
   * in `className` — both are the same Tailwind utility group, so which one
   * wins depends on stylesheet order, not on the order they're passed.
   */
  fit?: "cover" | "contain";
}

export default function AffairImage({
  asset,
  sizes,
  priority = false,
  className = "",
  alt,
  fit = "cover",
}: AffairImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- intentional: see file header
    <img
      src={affairFallbackSrc(asset)}
      srcSet={affairSrcSet(asset)}
      sizes={sizes}
      width={asset.w}
      height={asset.h}
      alt={alt ?? asset.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding={priority ? "sync" : "async"}
      className={`absolute inset-0 h-full w-full ${
        fit === "contain" ? "object-contain" : "object-cover"
      } ${className}`}
    />
  );
}
