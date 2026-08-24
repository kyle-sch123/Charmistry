/**
 * Regenerates the responsive variants of the home hero image.
 *
 * `next.config.ts` sets `images.unoptimized` (Cloudflare Workers doesn't run
 * Next's optimizer), so next/image emits a single `src` and no srcset — which
 * meant every phone downloaded the full 2880px, 221KB master. These variants
 * are committed alongside it and wired into a plain <img srcSet> in
 * HeroSection so the browser can pick.
 *
 * Run after replacing hero-section.webp:
 *   node scripts/generate-hero-variants.mjs
 */

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "..", "src", "assets", "images");
const master = path.join(dir, "hero-section.webp");

// The hero is object-cover on a full-viewport box, so the width it actually
// renders at is max(100vw, 100vh × 4/3) — larger than the viewport on a phone.
// 1280/1920 cover everything up to a high-DPR desktop; the master serves the
// rest.
const WIDTHS = [1280, 1920];
const QUALITY = 80;

const { width, height } = await sharp(master).metadata();
console.log(`master ${width}x${height} — ${kb(fs.statSync(master).size)}`);

for (const w of WIDTHS) {
  const out = path.join(dir, `hero-section-${w}.webp`);
  await sharp(master)
    .resize({ width: w })
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(out);
  console.log(`  ${path.basename(out)} — ${kb(fs.statSync(out).size)}`);
}

function kb(bytes) {
  return `${Math.round(bytes / 1024)}KB`;
}
