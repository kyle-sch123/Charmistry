import { describe, expect, it } from "vitest";
import { formatPrice, isAdjustableSize } from "@/lib/utils";

describe("formatPrice", () => {
  it("prefixes the amount with R", () => {
    expect(formatPrice(0)).toBe("R0");
    expect(formatPrice(49)).toBe("R49");
  });

  it("keeps the R prefix and digits for grouped amounts", () => {
    // The thousands separator is locale-dependent, so assert prefix + digits only.
    const formatted = formatPrice(1234);
    expect(formatted.startsWith("R")).toBe(true);
    expect(formatted.replace(/\D/g, "")).toBe("1234");
  });
});

describe("isAdjustableSize", () => {
  it("treats the 0 / 0.0 sentinel as adjustable", () => {
    expect(isAdjustableSize(0)).toBe(true);
    expect(isAdjustableSize("0")).toBe(true);
    expect(isAdjustableSize("0.0")).toBe(true);
    expect(isAdjustableSize(" 0 ")).toBe(true);
  });

  it("treats real sizes as fixed", () => {
    expect(isAdjustableSize(7)).toBe(false);
    expect(isAdjustableSize("18")).toBe(false);
  });

  it("is false for null / undefined", () => {
    expect(isAdjustableSize(null)).toBe(false);
    expect(isAdjustableSize(undefined)).toBe(false);
  });
});
