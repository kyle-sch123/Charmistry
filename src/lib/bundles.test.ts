import { describe, expect, it } from "vitest";
import {
  EVERYDAY_EDIT_BUNDLE,
  RINGS_STACK,
  resolveBundleDiscount,
  type BundleLine,
} from "@/lib/bundles";

const EDIT = EVERYDAY_EDIT_BUNDLE.itemSlugs;

/** One of every edit piece, quantity 1 each. */
const fullEdit = (): BundleLine[] => EDIT.map((slug) => ({ slug, quantity: 1 }));

describe("EVERYDAY_EDIT_BUNDLE config", () => {
  // Tripwire: the bundle matches by exact slug, so these MUST stay identical to
  // the EDIT list in app/collections/everyday/page.tsx. A drift (e.g. the
  // earring piece changing from Kira to Sia without updating both) silently
  // stops the discount from ever applying — the bug this test guards against.
  it("lists the edit's five pieces by their exact catalogue slugs", () => {
    expect(EVERYDAY_EDIT_BUNDLE.itemSlugs).toEqual([
      "nova-necklaces-gold",
      "lucy-necklaces-gold",
      "sia-earrings-gold",
      "sole-rings-gold",
      "mila-bracelets-gold",
    ]);
  });
});

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

/** A ring line at R500 each unless overridden. */
const ring = (n = 1, price = 500): BundleLine => ({
  slug: `ring-${Math.random()}`,
  category: "rings",
  price,
  quantity: n,
});

describe("resolveBundleDiscount — rings Stack & Save", () => {
  it("takes 15% off the ring subtotal once 3 rings are in the cart", () => {
    const result = resolveBundleDiscount([ring(3, 500)]);
    expect(result).not.toBeNull();
    expect(result?.code).toBe(RINGS_STACK.code);
    // 3 × R500 = R1500 → 15% = R225
    expect(result?.amount).toBe(225);
  });

  it("does not apply below the 3-ring threshold", () => {
    expect(resolveBundleDiscount([ring(2, 500)])).toBeNull();
  });

  it("counts rings split across separate lines toward the threshold", () => {
    const result = resolveBundleDiscount([
      ring(1, 400),
      ring(1, 600),
      ring(1, 500),
    ]);
    // (400 + 600 + 500) × 15% = 225
    expect(result?.amount).toBe(225);
  });

  it("discounts all rings once unlocked, not just the first three", () => {
    const result = resolveBundleDiscount([ring(4, 500)]);
    // 4 × R500 = R2000 → 15% = R300
    expect(result?.amount).toBe(300);
    expect(result?.sets).toBe(1);
  });

  it("only discounts rings, never other categories in the same cart", () => {
    const result = resolveBundleDiscount([
      ring(3, 500),
      { slug: "some-necklace", category: "necklaces", price: 1000, quantity: 1 },
    ]);
    // Discount base is the rings only: 1500 × 15% = 225 (necklace excluded)
    expect(result?.amount).toBe(225);
  });

  it("does not fire on rings that carry no usable price", () => {
    expect(
      resolveBundleDiscount([
        { slug: "r1", category: "rings", price: 0, quantity: 3 },
      ]),
    ).toBeNull();
  });

  it("returns whichever cart-aware discount saves more", () => {
    // Full Everyday Edit (R110 off) plus 3 separate high-value rings whose
    // stack (R450) beats the edit → the stack wins.
    const lines: BundleLine[] = [...fullEdit(), ring(3, 1000)];
    const result = resolveBundleDiscount(lines);
    expect(result?.code).toBe(RINGS_STACK.code);
    expect(result?.amount).toBe(450);
  });
});
