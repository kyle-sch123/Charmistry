/**
 * The srcset ladder must only ever name files that are actually in the bucket.
 *
 * A missing candidate is not a soft failure. The browser picks a rung by device
 * pixels, so a hole at the top of the ladder renders a broken image on exactly
 * the devices that reach that high and stays invisible everywhere else:
 * `daily-affair-campaign-03` shipped without its full-size original, which broke
 * the Isa Bracelet's card on DPR-3 phones (100vw → ~1170px) and on Retina
 * desktops (48vw → ~1380px) while a DPR-1 desktop (~690px → the 960 rung)
 * looked perfectly fine. Nothing but a test catches that shape of bug.
 */

import { describe, expect, it } from "vitest";
import {
  IMG,
  affairFallbackSrc,
  affairSrcSet,
  type AffairAsset,
} from "./daily-affair";

const ASSETS = Object.entries(IMG) as [string, AffairAsset][];

/** The `<w>` of each candidate in a srcset, in the order they're offered. */
function widthsOf(asset: AffairAsset): number[] {
  return affairSrcSet(asset)
    .split(", ")
    .map((candidate) => Number(candidate.split(" ")[1].replace("w", "")));
}

describe("the affair image ladder", () => {
  it("tops out at the widest file each asset actually has", () => {
    for (const [name, asset] of ASSETS) {
      expect(Math.max(...widthsOf(asset)), name).toBe(asset.topRung ?? asset.w);
    }
  });

  it("offers rungs in ascending order, with no upscales", () => {
    for (const [name, asset] of ASSETS) {
      const widths = widthsOf(asset);
      expect(widths, name).toEqual([...widths].sort((a, b) => a - b));
      expect(Math.max(...widths), name).toBeLessThanOrEqual(asset.w);
    }
  });

  it("only ever falls back to a URL the srcset also offers", () => {
    for (const [name, asset] of ASSETS) {
      expect(affairSrcSet(asset), name).toContain(affairFallbackSrc(asset));
    }
  });

  it("withholds the full-size original from an asset that declares a topRung", () => {
    const srcset = affairSrcSet(IMG.campaignHands);
    // The file that 404s. Space-suffixed so it can't match the `-960` variant.
    expect(srcset).not.toContain("daily-affair-campaign-03.webp ");
    expect(srcset).toContain("daily-affair-campaign-03-960.webp 960w");
    expect(affairFallbackSrc(IMG.campaignHands)).toContain(
      "daily-affair-campaign-03-960.webp",
    );
  });

  it("leaves assets without a topRung on the full-size original", () => {
    expect(affairSrcSet(IMG.campaignSeated)).toContain(
      "daily-affair-campaign-01.webp 1800w",
    );
  });
});
