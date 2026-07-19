import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "@/lib/auth/redirect";

describe("sanitizeNextPath", () => {
  it("passes through same-site absolute paths", () => {
    expect(sanitizeNextPath("/account/orders")).toBe("/account/orders");
  });

  it("falls back for null / undefined / empty input", () => {
    expect(sanitizeNextPath(null)).toBe("/account");
    expect(sanitizeNextPath(undefined)).toBe("/account");
    expect(sanitizeNextPath("")).toBe("/account");
  });

  it("blocks protocol-relative and absolute URLs (open-redirect guard)", () => {
    expect(sanitizeNextPath("//evil.com")).toBe("/account");
    expect(sanitizeNextPath("https://evil.com")).toBe("/account");
    expect(sanitizeNextPath("/\\evil.com")).toBe("/account");
  });

  it("honours a custom fallback", () => {
    expect(sanitizeNextPath(null, "/login")).toBe("/login");
  });
});
