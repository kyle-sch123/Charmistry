import { describe, expect, it } from "vitest";
import {
  EVERYDAY_EDIT_BUNDLE,
  DAILY_AFFAIR_BUNDLE,
  RINGS_STACK,
  MIX_MATCH_STACK,
  resolveBundleDiscount,
  resolveShippingPerk,
  type BundleLine,
} from "@/lib/bundles";
import {
  DAILY_AFFAIR_PIECES,
  DAILY_AFFAIR_SAVINGS,
} from "@/lib/daily-affair";
// The seed script is plain .mjs (it runs under bare node, not Next), so its
// rows arrive untyped. Shape them here — that shape is itself part of the
// contract this file guards.
import { SEED_ROWS as RAW_SEED_ROWS } from "../../scripts/seed-daily-affair.mjs";

interface SeedRow {
  slug: string;
  name: string;
  metal: "gold" | "silver";
  price: number;
  category: string;
}
const SEED_ROWS = RAW_SEED_ROWS as SeedRow[];

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
    expect(result?.amount).toBe(175);
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
    expect(resolveBundleDiscount(withExtras)?.amount).toBe(175);
  });

  it("counts complete sets by the scarcest piece", () => {
    // Two of everything except one piece → only one complete set.
    const lines: BundleLine[] = EDIT.map((slug, i) => ({
      slug,
      quantity: i === 0 ? 1 : 2,
    }));
    const result = resolveBundleDiscount(lines);
    expect(result?.sets).toBe(1);
    expect(result?.amount).toBe(175);
  });

  it("multiplies the discount for multiple complete sets", () => {
    const twoSets: BundleLine[] = EDIT.map((slug) => ({ slug, quantity: 2 }));
    const result = resolveBundleDiscount(twoSets);
    expect(result?.sets).toBe(2);
    expect(result?.amount).toBe(350);
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

describe("RINGS_STACK config", () => {
  // Tripwire: the /shop rings banner and the PDP RingsStackBanner render their
  // promise straight from this config, and checkout honours it. Any edit here
  // must be deliberate.
  it("rewards 3 rings with free locker-to-locker shipping", () => {
    expect(RINGS_STACK.category).toBe("rings");
    expect(RINGS_STACK.minQuantity).toBe(3);
    expect(RINGS_STACK.shippingPerk).toBe("locker_only");
  });
});

describe("resolveShippingPerk — rings Stack & Save", () => {
  it("frees the locker method once 3 rings are in the cart", () => {
    const result = resolveShippingPerk([ring(3, 500)]);
    expect(result).not.toBeNull();
    expect(result?.code).toBe(RINGS_STACK.code);
    expect(result?.perk).toBe("locker_only");
  });

  it("does not apply below the 3-ring threshold", () => {
    expect(resolveShippingPerk([ring(2, 500)])).toBeNull();
  });

  it("counts rings split across separate lines toward the threshold", () => {
    const result = resolveShippingPerk([
      ring(1, 400),
      ring(1, 600),
      ring(1, 500),
    ]);
    expect(result?.code).toBe(RINGS_STACK.code);
  });

  it("qualifies regardless of line prices — the perk is not priced", () => {
    // Unlike the old 15%-off stack, a price of 0 can't zero the reward out.
    const result = resolveShippingPerk([
      { slug: "r1", category: "rings", price: 0, quantity: 3 },
    ]);
    expect(result?.perk).toBe("locker_only");
  });

  it("no longer produces a ZAR discount line", () => {
    // The stacks moved from 15% off to a shipping perk — the discount
    // resolver must ignore them entirely (which is also what lets a typed
    // code coexist with a stack now).
    expect(resolveBundleDiscount([ring(3, 1000)])).toBeNull();
  });

  it("prefers the Everyday Edit's any-method perk over the locker perk", () => {
    const lines: BundleLine[] = [...fullEdit(), ring(3, 1000)];
    const result = resolveShippingPerk(lines);
    expect(result?.code).toBe(EVERYDAY_EDIT_BUNDLE.code);
    expect(result?.perk).toBe("all_methods");
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
  // Tripwire: the PDP StackBuilder renders its slots and its free-shipping
  // promise straight from this config. Changing it changes what checkout
  // honours, so any edit here must be deliberate.
  it("requires one necklace, one earrings and one bracelet for the perk", () => {
    expect(MIX_MATCH_STACK.categories).toEqual([
      "necklaces",
      "earrings",
      "bracelets",
    ]);
    expect(MIX_MATCH_STACK.shippingPerk).toBe("locker_only");
  });
});

describe("resolveShippingPerk — Create Your Own Stack", () => {
  it("frees the locker method once one of each category is in the cart", () => {
    const result = resolveShippingPerk(trio(400));
    expect(result).not.toBeNull();
    expect(result?.code).toBe(MIX_MATCH_STACK.code);
    expect(result?.perk).toBe("locker_only");
  });

  it("does not apply while any category is missing", () => {
    const noBracelet = [piece("necklaces"), piece("earrings")];
    expect(resolveShippingPerk(noBracelet)).toBeNull();
    // Depth in one category can't substitute for breadth across all three.
    expect(resolveShippingPerk([piece("necklaces", 400, 3)])).toBeNull();
  });

  it("no longer produces a ZAR discount line", () => {
    expect(resolveBundleDiscount(trio(1000))).toBeNull();
  });

  it("returns one perk when both stacks qualify", () => {
    // Same tier ("locker_only") — the mix stack is checked first and wins;
    // either way the customer outcome is identical: the locker ships free.
    const result = resolveShippingPerk([...trio(400), ring(3, 400)]);
    expect(result?.perk).toBe("locker_only");
    expect(result?.code).toBe(MIX_MATCH_STACK.code);
  });
});

describe("resolveShippingPerk — Everyday Edit", () => {
  it("frees every method when the full edit is in the cart", () => {
    const result = resolveShippingPerk(fullEdit());
    expect(result?.code).toBe(EVERYDAY_EDIT_BUNDLE.code);
    expect(result?.perk).toBe("all_methods");
  });

  it("keeps the R175 discount alongside the perk", () => {
    // The edit's reward is additive: money off AND free delivery.
    expect(resolveBundleDiscount(fullEdit())?.amount).toBe(175);
    expect(resolveShippingPerk(fullEdit())?.perk).toBe("all_methods");
  });

  it("returns null for an empty or unqualifying cart", () => {
    expect(resolveShippingPerk([])).toBeNull();
    expect(
      resolveShippingPerk([{ slug: "random-piece", quantity: 2 }]),
    ).toBeNull();
  });
});

describe("DAILY_AFFAIR_BUNDLE config", () => {
  // The Everyday Edit keeps its slugs in two hand-maintained lists guarded by
  // the tripwire above. The Daily Affair derives them instead, so the drift
  // this asserts is structurally impossible — the test documents that contract
  // rather than policing a copy-paste.
  it("derives its slugs from the collection's pieces", () => {
    expect(DAILY_AFFAIR_BUNDLE.itemSlugs).toEqual(
      DAILY_AFFAIR_PIECES.map((p) => p.slug),
    );
    expect(DAILY_AFFAIR_BUNDLE.itemSlugs).toHaveLength(5);
  });

  it("saves the same amount the collection page advertises", () => {
    expect(DAILY_AFFAIR_BUNDLE.discountPerSet).toBe(DAILY_AFFAIR_SAVINGS);
  });

  it("cannot collide with the Everyday Edit", () => {
    const overlap = DAILY_AFFAIR_BUNDLE.itemSlugs.filter((s) =>
      EVERYDAY_EDIT_BUNDLE.itemSlugs.includes(s),
    );
    expect(overlap).toEqual([]);
  });
});

describe("resolveBundleDiscount — The Daily Affair", () => {
  const fullAffair = (): BundleLine[] =>
    DAILY_AFFAIR_BUNDLE.itemSlugs.map((slug) => ({ slug, quantity: 1 }));

  // The point of this one: the bundle ships before its catalogue rows exist.
  // An empty/unrelated cart must never see it, or the page would promise a
  // saving checkout wouldn't honour.
  it("stays inert for carts that don't hold the edit", () => {
    expect(resolveBundleDiscount([])).toBeNull();
    expect(
      resolveBundleDiscount([{ slug: "ivy-rings-gold", quantity: 3 }]),
    ).toBeNull();
  });

  it("applies once every piece is in the bag", () => {
    const result = resolveBundleDiscount(fullAffair());
    expect(result?.code).toBe("DAILY-AFFAIR");
    expect(result?.amount).toBe(DAILY_AFFAIR_SAVINGS);
    expect(result?.sets).toBe(1);
  });

  it("does not apply when a single piece is missing", () => {
    const short = fullAffair().slice(0, -1);
    expect(resolveBundleDiscount(short)).toBeNull();
  });

  it("counts complete sets by the scarcest piece", () => {
    const lines = DAILY_AFFAIR_BUNDLE.itemSlugs.map((slug, i) => ({
      slug,
      quantity: i === 0 ? 1 : 2,
    }));
    expect(resolveBundleDiscount(lines)?.sets).toBe(1);
  });

  it("earns free delivery on any method", () => {
    const perk = resolveShippingPerk(fullAffair());
    expect(perk?.code).toBe("DAILY-AFFAIR");
    expect(perk?.perk).toBe("all_methods");
  });
});

describe("seed-daily-affair.mjs stays in step with the collection", () => {
  // The seed script writes the catalogue rows the bundle matches on. If a slug
  // or a price is edited in one place and not the other, the page advertises a
  // saving that resolveBundleDiscount will never grant — and nothing else in
  // the system would notice. This is that alarm.
  const edit = SEED_ROWS.filter((r) => r.metal === "gold");
  const rowFor = (slug: string) => {
    const row = SEED_ROWS.find((r) => r.slug === slug);
    if (!row) throw new Error(`no seed row for ${slug}`);
    return row;
  };

  it("seeds exactly the five gold pieces the edit is built from", () => {
    expect(edit.map((r) => r.slug)).toEqual(
      DAILY_AFFAIR_PIECES.map((p) => p.slug),
    );
  });

  it("seeds each piece at the price the page displays", () => {
    for (const piece of DAILY_AFFAIR_PIECES) {
      expect(rowFor(piece.slug).price, `price drift on ${piece.slug}`).toBe(
        piece.price,
      );
    }
  });

  it("files each piece under the category the page names", () => {
    for (const piece of DAILY_AFFAIR_PIECES) {
      expect(rowFor(piece.slug).category).toBe(piece.category);
    }
  });

  it("gives every seeded row a unique slug", () => {
    const slugs = SEED_ROWS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
