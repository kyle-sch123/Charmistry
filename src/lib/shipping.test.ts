import { describe, expect, it } from "vitest";
import {
  FREE_DOOR_THRESHOLD,
  FREE_LOCKER_THRESHOLD,
  LOCKER_MILESTONE_PERCENT,
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
    expect(shippingCostForMethod("pudo_locker", 100)).toBe(49);
    expect(shippingCostForMethod("courier_economy", 100)).toBe(79);
  });

  it("still charges one rand below the locker threshold", () => {
    expect(shippingCostForMethod("pudo_locker", FREE_LOCKER_THRESHOLD - 1)).toBe(49);
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
    expect(shippingCostForMethod("pudo_locker", 100, null)).toBe(49);
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
