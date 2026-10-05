import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHIPPING_RATES,
  FREE_DOOR_THRESHOLD,
  FREE_LOCKER_THRESHOLD,
  LOCKER_MILESTONE_PERCENT,
  MAX_SHIPPING_PRICE,
  isShippingMethodId,
  parseShippingPrice,
  ratesFromRows,
  resolveFreeShippingProgress,
  resolveShippingMethod,
  shippingCostForMethod,
  shippingMethodLabel,
} from "@/lib/shipping";

describe("resolveShippingMethod", () => {
  it("falls back to the default method for empty input", () => {
    expect(resolveShippingMethod("")?.id).toBe("pudo_locker");
    expect(resolveShippingMethod(null)?.id).toBe("pudo_locker");
    expect(resolveShippingMethod(undefined)?.id).toBe("pudo_locker");
  });

  it("resolves a known method id", () => {
    expect(resolveShippingMethod("courier_economy")?.id).toBe("courier_economy");
  });

  it("returns null for an unknown (tampered) id", () => {
    expect(resolveShippingMethod("free_yacht")).toBeNull();
  });
});

describe("shippingCostForMethod", () => {
  it("charges both methods below the locker threshold", () => {
    expect(shippingCostForMethod("pudo_locker", 100)).toBe(59);
    expect(shippingCostForMethod("courier_economy", 100)).toBe(79);
  });

  it("still charges one rand below the locker threshold", () => {
    expect(shippingCostForMethod("pudo_locker", FREE_LOCKER_THRESHOLD - 1)).toBe(59);
    expect(shippingCostForMethod("courier_economy", FREE_LOCKER_THRESHOLD - 1)).toBe(79);
  });

  it("frees ONLY the locker between the two thresholds", () => {
    // The tiers are independent, not a credit: R500 buys the locker method and
    // nothing else, so door-to-door keeps its full R79 right up to R700.
    for (const amount of [
      FREE_LOCKER_THRESHOLD,
      FREE_LOCKER_THRESHOLD + 1,
      FREE_DOOR_THRESHOLD - 1,
    ]) {
      expect(shippingCostForMethod("pudo_locker", amount)).toBe(0);
      expect(shippingCostForMethod("courier_economy", amount)).toBe(79);
    }
  });

  it("frees every method at or above the door threshold", () => {
    expect(shippingCostForMethod("pudo_locker", FREE_DOOR_THRESHOLD)).toBe(0);
    expect(shippingCostForMethod("courier_economy", FREE_DOOR_THRESHOLD)).toBe(0);
    expect(shippingCostForMethod("courier_economy", FREE_DOOR_THRESHOLD + 1)).toBe(0);
  });

  it("is free when the order is fully covered by a discount (amount <= 0)", () => {
    // A comp / 100%-off order pays nothing for goods, so it isn't charged
    // shipping either — keeps the zero-total (PayFast-skip) path reachable.
    expect(shippingCostForMethod("pudo_locker", 0)).toBe(0);
    expect(shippingCostForMethod("courier_economy", 0)).toBe(0);
  });

  it("frees only the locker method under a locker_only perk (the stacks)", () => {
    expect(shippingCostForMethod("pudo_locker", 100, "locker_only")).toBe(0);
    // Standard Economy keeps its flat price — the perk is locker-specific.
    expect(shippingCostForMethod("courier_economy", 100, "locker_only")).toBe(79);
  });

  it("frees every method under an all_methods perk (the Everyday Edit)", () => {
    expect(shippingCostForMethod("pudo_locker", 100, "all_methods")).toBe(0);
    expect(shippingCostForMethod("courier_economy", 100, "all_methods")).toBe(0);
  });

  it("treats an absent perk exactly like the pre-perk behaviour", () => {
    expect(shippingCostForMethod("pudo_locker", 100, null)).toBe(59);
    expect(shippingCostForMethod("pudo_locker", FREE_DOOR_THRESHOLD, null)).toBe(0);
  });

  it("keeps the all_methods perk worth having below the door threshold", () => {
    // Between the tiers the perk is the ONLY thing that frees door delivery,
    // which is what stops the Everyday Edit / Daily Affair reward going hollow.
    const between = FREE_LOCKER_THRESHOLD + 50;
    expect(shippingCostForMethod("courier_economy", between)).toBe(79);
    expect(shippingCostForMethod("courier_economy", between, "all_methods")).toBe(0);
  });
});

describe("resolveFreeShippingProgress", () => {
  it("targets the locker tier first", () => {
    const p = resolveFreeShippingProgress(380);
    expect(p.lockerFree).toBe(false);
    expect(p.doorFree).toBe(false);
    expect(p.nextThreshold).toBe(FREE_LOCKER_THRESHOLD);
    expect(p.remaining).toBe(120);
  });

  it("switches to the door tier once the locker is free", () => {
    const p = resolveFreeShippingProgress(550);
    expect(p.lockerFree).toBe(true);
    expect(p.doorFree).toBe(false);
    expect(p.nextThreshold).toBe(FREE_DOOR_THRESHOLD);
    expect(p.remaining).toBe(150);
  });

  it("has nothing left to reach once door delivery is free", () => {
    const p = resolveFreeShippingProgress(FREE_DOOR_THRESHOLD);
    expect(p.lockerFree).toBe(true);
    expect(p.doorFree).toBe(true);
    expect(p.nextThreshold).toBeNull();
    expect(p.remaining).toBe(0);
    expect(p.progress).toBe(100);
  });

  it("fills the bar proportionally against the door threshold", () => {
    expect(resolveFreeShippingProgress(1).progress).toBeCloseTo(0.14, 2);
    expect(resolveFreeShippingProgress(350).progress).toBe(50);
    // At the locker milestone the fill must land exactly on the dot, or the
    // bar would celebrate a tier the fill hasn't visually reached.
    expect(resolveFreeShippingProgress(FREE_LOCKER_THRESHOLD).progress).toBeCloseTo(
      LOCKER_MILESTONE_PERCENT,
      10,
    );
  });

  it("never reports a tier the price function would charge for", () => {
    // The bar and the charge must agree at every rand around both thresholds.
    for (const amount of [0, 1, 499, 500, 501, 699, 700, 701, 5000]) {
      const p = resolveFreeShippingProgress(amount);
      expect(p.lockerFree).toBe(shippingCostForMethod("pudo_locker", amount) === 0);
      expect(p.doorFree).toBe(
        shippingCostForMethod("courier_economy", amount) === 0,
      );
    }
  });

  it("reports a zero total as fully unlocked, matching the price rule", () => {
    // amount <= 0 is the comp / 100%-off case: shipping genuinely is free, so
    // the bar must say so rather than showing an empty track. Unreachable from
    // the drawer (it renders an empty-cart state instead), but the helper has
    // to agree with shippingCostForMethod at every input, not most of them.
    const p = resolveFreeShippingProgress(0);
    expect(p.doorFree).toBe(true);
    expect(p.progress).toBe(100);
  });

  it("unlocks outright on a perk but still fills by spend", () => {
    const p = resolveFreeShippingProgress(200, "all_methods");
    expect(p.doorFree).toBe(true);
    expect(p.nextThreshold).toBeNull();
    // Progress is pinned to 100 once everything is free — there is no further
    // tier for the bar to be counting towards.
    expect(p.progress).toBe(100);

    const lockerOnly = resolveFreeShippingProgress(200, "locker_only");
    expect(lockerOnly.lockerFree).toBe(true);
    expect(lockerOnly.doorFree).toBe(false);
    expect(lockerOnly.nextThreshold).toBe(FREE_DOOR_THRESHOLD);
    expect(lockerOnly.remaining).toBe(500);
  });
});

describe("shippingMethodLabel", () => {
  it("returns the label for a known id", () => {
    expect(shippingMethodLabel("courier_economy")).toBe("Standard Economy");
  });
  it("returns null for an unknown id", () => {
    expect(shippingMethodLabel("nope")).toBeNull();
  });
});

describe("owner-set shipping rates", () => {
  const custom = { pudo_locker: 65, courier_economy: 89.5 } as const;

  it("defaults to the built-in prices", () => {
    expect(DEFAULT_SHIPPING_RATES).toEqual({ pudo_locker: 59, courier_economy: 79 });
  });

  it("charges the supplied rates instead of the defaults", () => {
    expect(shippingCostForMethod("pudo_locker", 100, null, custom)).toBe(65);
    expect(shippingCostForMethod("courier_economy", 100, null, custom)).toBe(89.5);
  });

  it("still lets the thresholds and perks win over a custom rate", () => {
    // Raising a price must never resurrect a charge the free tiers waive.
    expect(shippingCostForMethod("pudo_locker", FREE_LOCKER_THRESHOLD, null, custom)).toBe(0);
    expect(shippingCostForMethod("courier_economy", FREE_LOCKER_THRESHOLD, null, custom)).toBe(89.5);
    expect(shippingCostForMethod("courier_economy", FREE_DOOR_THRESHOLD, null, custom)).toBe(0);
    expect(shippingCostForMethod("courier_economy", 100, "all_methods", custom)).toBe(0);
    expect(shippingCostForMethod("courier_economy", 0, null, custom)).toBe(0);
  });
});

describe("parseShippingPrice", () => {
  it("accepts positive amounts as numbers or numeric strings", () => {
    expect(parseShippingPrice(59)).toBe(59);
    expect(parseShippingPrice("79")).toBe(79);
    expect(parseShippingPrice(" 65.5 ")).toBe(65.5);
    expect(parseShippingPrice(MAX_SHIPPING_PRICE)).toBe(MAX_SHIPPING_PRICE);
  });

  it("rounds to cents", () => {
    expect(parseShippingPrice(59.999)).toBe(60);
    expect(parseShippingPrice("49.994")).toBe(49.99);
  });

  it("rejects zero — free delivery is the thresholds' job, not a R0 price", () => {
    expect(parseShippingPrice(0)).toBeNull();
    expect(parseShippingPrice("0")).toBeNull();
    // Rounds to R0.00, so it's a zero price too.
    expect(parseShippingPrice(0.001)).toBeNull();
  });

  it("rejects negatives, typos past the cap, and non-numbers", () => {
    for (const bad of [
      -1,
      MAX_SHIPPING_PRICE + 0.01,
      7900,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "",
      "   ",
      "R59",
      "abc",
      null,
      undefined,
      true,
      {},
    ]) {
      expect(parseShippingPrice(bad)).toBeNull();
    }
  });
});

describe("ratesFromRows", () => {
  it("returns the defaults when there are no rows", () => {
    expect(ratesFromRows([])).toEqual(DEFAULT_SHIPPING_RATES);
    expect(ratesFromRows(null)).toEqual(DEFAULT_SHIPPING_RATES);
  });

  it("overlays stored prices on the defaults, method by method", () => {
    expect(ratesFromRows([{ method_id: "courier_economy", price: 95 }])).toEqual({
      pudo_locker: 59,
      courier_economy: 95,
    });
  });

  it("accepts numeric strings (how a numeric column can arrive)", () => {
    expect(ratesFromRows([{ method_id: "pudo_locker", price: "62.50" }]).pudo_locker).toBe(62.5);
  });

  it("ignores unknown methods and unusable prices rather than charging them", () => {
    const rates = ratesFromRows([
      { method_id: "free_yacht", price: 1 },
      { method_id: "pudo_locker", price: 0 },
      { method_id: "courier_economy", price: "nope" },
    ]);
    expect(rates).toEqual(DEFAULT_SHIPPING_RATES);
    expect(rates).not.toHaveProperty("free_yacht");
  });

  it("never mutates the shared defaults", () => {
    ratesFromRows([{ method_id: "pudo_locker", price: 99 }]);
    expect(DEFAULT_SHIPPING_RATES.pudo_locker).toBe(59);
  });
});

describe("isShippingMethodId", () => {
  it("recognises only catalogue method ids", () => {
    expect(isShippingMethodId("pudo_locker")).toBe(true);
    expect(isShippingMethodId("courier_economy")).toBe(true);
    expect(isShippingMethodId("free_yacht")).toBe(false);
    expect(isShippingMethodId(undefined)).toBe(false);
  });
});
