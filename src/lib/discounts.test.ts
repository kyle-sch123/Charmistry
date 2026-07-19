import { describe, expect, it } from "vitest";
import { computeDiscountAmount, normalizeCode } from "@/lib/discounts";
import type { DiscountCode } from "@/types";

function makeCode(overrides: Partial<DiscountCode>): DiscountCode {
  return {
    id: "d1",
    code: "SAVE",
    discount_type: "percentage",
    discount_value: 10,
    min_order_amount: 0,
    max_uses: null,
    uses_count: 0,
    expires_at: null,
    active: true,
    email: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("normalizeCode", () => {
  it("trims and uppercases", () => {
    expect(normalizeCode("  save10 ")).toBe("SAVE10");
  });
  it("returns an empty string for whitespace-only input", () => {
    expect(normalizeCode("   ")).toBe("");
  });
});

describe("computeDiscountAmount", () => {
  it("computes a percentage of the subtotal", () => {
    expect(computeDiscountAmount(makeCode({ discount_value: 10 }), 250)).toBe(25);
  });

  it("returns the flat value for fixed-type codes", () => {
    const code = makeCode({ discount_type: "fixed", discount_value: 50 });
    expect(computeDiscountAmount(code, 250)).toBe(50);
  });

  it("never exceeds the subtotal", () => {
    const code = makeCode({ discount_type: "fixed", discount_value: 500 });
    expect(computeDiscountAmount(code, 120)).toBe(120);
  });

  it("rounds to two decimals", () => {
    // 33.33 * 15% = 4.9995 -> 5.00
    expect(computeDiscountAmount(makeCode({ discount_value: 15 }), 33.33)).toBe(5);
  });
});
