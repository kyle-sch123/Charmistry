import { describe, expect, it } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD,
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
  it("charges the method price below the free-shipping threshold", () => {
    expect(shippingCostForMethod("pudo_locker", 100)).toBe(49);
    expect(shippingCostForMethod("courier_economy", 100)).toBe(79);
  });

  it("is free at or above the threshold", () => {
    expect(shippingCostForMethod("courier_economy", FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(shippingCostForMethod("courier_economy", FREE_SHIPPING_THRESHOLD + 1)).toBe(0);
  });

  it("still charges one rand below the threshold", () => {
    expect(shippingCostForMethod("pudo_locker", FREE_SHIPPING_THRESHOLD - 1)).toBe(49);
  });

  it("is free when the order is fully covered by a discount (amount <= 0)", () => {
    // A comp / 100%-off order pays nothing for goods, so it isn't charged
    // shipping either — keeps the zero-total (PayFast-skip) path reachable.
    expect(shippingCostForMethod("pudo_locker", 0)).toBe(0);
    expect(shippingCostForMethod("courier_economy", 0)).toBe(0);
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
