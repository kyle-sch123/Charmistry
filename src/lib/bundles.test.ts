import { describe, expect, it } from "vitest";
import {
  EVERYDAY_EDIT_BUNDLE,
  resolveBundleDiscount,
  type BundleLine,
} from "@/lib/bundles";

const EDIT = EVERYDAY_EDIT_BUNDLE.itemSlugs;

/** One of every edit piece, quantity 1 each. */
const fullEdit = (): BundleLine[] => EDIT.map((slug) => ({ slug, quantity: 1 }));

describe("resolveBundleDiscount", () => {
  it("applies the Everyday Edit when every piece is present", () => {
    const result = resolveBundleDiscount(fullEdit());
    expect(result).not.toBeNull();
    expect(result?.code).toBe("EVERYDAY-EDIT");
    expect(result?.amount).toBe(110);
    expect(result?.sets).toBe(1);
  });

  it("does not apply when a piece is missing", () => {
    const missingRing = fullEdit().filter(
      (l) => l.slug !== "sole-rings-gold",
    );
    expect(resolveBundleDiscount(missingRing)).toBeNull();
  });

  it("still applies when unrelated items are also in the cart", () => {
    const withExtras: BundleLine[] = [
      ...fullEdit(),
      { slug: "some-other-necklace-silver", quantity: 2 },
    ];
    expect(resolveBundleDiscount(withExtras)?.amount).toBe(110);
  });

  it("counts complete sets by the scarcest piece", () => {
    // Two of everything except one piece → only one complete set.
    const lines: BundleLine[] = EDIT.map((slug, i) => ({
      slug,
      quantity: i === 0 ? 1 : 2,
    }));
    const result = resolveBundleDiscount(lines);
    expect(result?.sets).toBe(1);
    expect(result?.amount).toBe(110);
  });

  it("multiplies the discount for multiple complete sets", () => {
    const twoSets: BundleLine[] = EDIT.map((slug) => ({ slug, quantity: 2 }));
    const result = resolveBundleDiscount(twoSets);
    expect(result?.sets).toBe(2);
    expect(result?.amount).toBe(220);
  });

  it("aggregates duplicate lines of the same slug", () => {
    // The same piece split across two lines still counts toward the set.
    const split: BundleLine[] = [
      ...EDIT.slice(1).map((slug) => ({ slug, quantity: 1 })),
      { slug: EDIT[0], quantity: 0 },
      { slug: EDIT[0], quantity: 1 },
    ];
    expect(resolveBundleDiscount(split)?.sets).toBe(1);
  });

  it("ignores null / non-positive quantities and empty carts", () => {
    expect(resolveBundleDiscount([])).toBeNull();
    expect(
      resolveBundleDiscount([{ slug: null, quantity: 5 }]),
    ).toBeNull();
    const zeroQty: BundleLine[] = EDIT.map((slug) => ({ slug, quantity: 0 }));
    expect(resolveBundleDiscount(zeroQty)).toBeNull();
  });
});
