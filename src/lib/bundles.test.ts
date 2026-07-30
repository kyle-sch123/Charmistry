import { describe, expect, it } from "vitest";
import {
  EVERYDAY_EDIT_BUNDLE,
  RINGS_STACK,
  MIX_MATCH_STACK,
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

/** One line in a mix-stack category at the given price. */
const piece = (
  category: string,
  price = 400,
  quantity = 1,
): BundleLine => ({
  slug: `${category}-${Math.random()}`,
  category,
  price,
  quantity,
});

/** One necklace + one earrings + one bracelet — the minimum unlocking trio. */
const trio = (price = 400): BundleLine[] =>
  MIX_MATCH_STACK.categories.map((c) => piece(c, price));

describe("MIX_MATCH_STACK config", () => {
  // Tripwire: the PDP StackBuilder renders its slots and its "15% off" promise
  // straight from this config. Changing it changes what checkout charges, so
  // any edit here must be deliberate.
  it("requires one necklace, one earrings and one bracelet for 15% off", () => {
    expect(MIX_MATCH_STACK.categories).toEqual([
      "necklaces",
      "earrings",
      "bracelets",
    ]);
    expect(MIX_MATCH_STACK.percentOff).toBe(15);
  });
});

describe("resolveBundleDiscount — Create Your Own Stack", () => {
  it("takes 15% off the trio once one of each category is in the cart", () => {
    const result = resolveBundleDiscount(trio(400));
    expect(result).not.toBeNull();
    expect(result?.code).toBe(MIX_MATCH_STACK.code);
    // (400 + 400 + 400) × 15% = 180
    expect(result?.amount).toBe(180);
    expect(result?.sets).toBe(1);
  });

  it("does not apply while any category is missing", () => {
    const noBracelet = [piece("necklaces"), piece("earrings")];
    expect(resolveBundleDiscount(noBracelet)).toBeNull();
    // Depth in one category can't substitute for breadth across all three.
    expect(
      resolveBundleDiscount([piece("necklaces", 400, 3)]),
    ).toBeNull();
  });

  it("discounts every piece in the three categories once unlocked", () => {
    // The rings-stack rule applied across categories: a second necklace joins
    // the discount base rather than sitting at full price.
    const result = resolveBundleDiscount([...trio(400), piece("necklaces", 600)]);
    // (1200 + 600) × 15% = 270
    expect(result?.amount).toBe(270);
  });

  it("never discounts categories outside the stack", () => {
    const result = resolveBundleDiscount([
      ...trio(400),
      piece("rings", 900),
      piece("jewellery-boxes", 800),
    ]);
    // Base stays the trio: 1200 × 15% = 180 (ring + box excluded)
    expect(result?.amount).toBe(180);
  });

  it("reports sets as the scarcest category's quantity", () => {
    const result = resolveBundleDiscount([
      piece("necklaces", 400, 2),
      piece("earrings", 400, 2),
      piece("bracelets", 400, 1),
    ]);
    expect(result?.sets).toBe(1);
  });

  it("does not fire on pieces that carry no usable price", () => {
    expect(
      resolveBundleDiscount(
        MIX_MATCH_STACK.categories.map((c) => piece(c, 0)),
      ),
    ).toBeNull();
  });

  it("loses to a rings stack that saves more, and wins when it saves more", () => {
    // Trio saves 180; three R1000 rings save 450 → rings win.
    const ringsWin = resolveBundleDiscount([...trio(400), ring(3, 1000)]);
    expect(ringsWin?.code).toBe(RINGS_STACK.code);
    // Trio of R1000 pieces saves 450; three R400 rings save 180 → mix wins.
    const mixWins = resolveBundleDiscount([...trio(1000), ring(3, 400)]);
    expect(mixWins?.code).toBe(MIX_MATCH_STACK.code);
    expect(mixWins?.amount).toBe(450);
  });
});
