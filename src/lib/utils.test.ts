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

  it("shows both cents digits, never a lone one", () => {
    // A 10% stack discount on a R527 trio lands on R474.30 — the default
    // toLocaleString drops the trailing zero and renders "R474,3".
    expect(formatPrice(474.3).replace(/\D/g, "")).toBe("47430");
    expect(formatPrice(52.7).replace(/\D/g, "")).toBe("5270");
    expect(formatPrice(12.34).replace(/\D/g, "")).toBe("1234");
  });

  it("leaves whole rands without a decimal part", () => {
    expect(formatPrice(159)).toBe("R159");
    expect(formatPrice(0)).toBe("R0");
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
