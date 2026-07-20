import { describe, expect, it } from "vitest";
import { extractBasicPassword, timingSafeEqual } from "@/lib/auth/admin-gate";

function basic(user: string, pass: string): string {
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

describe("extractBasicPassword", () => {
  it("extracts the password half, ignoring the username", () => {
    expect(extractBasicPassword(basic("admin", "s3cret"))).toBe("s3cret");
    expect(extractBasicPassword(basic("", "s3cret"))).toBe("s3cret");
  });

  it("keeps colons that appear inside the password", () => {
    expect(extractBasicPassword(basic("admin", "a:b:c"))).toBe("a:b:c");
  });

  it("is case-insensitive on the scheme", () => {
    expect(extractBasicPassword(`basic ${btoa("admin:x")}`)).toBe("x");
  });

  it("returns null for missing / non-Basic / malformed headers", () => {
    expect(extractBasicPassword(null)).toBeNull();
    expect(extractBasicPassword("Bearer token")).toBeNull();
    expect(extractBasicPassword("Basic")).toBeNull();
    expect(extractBasicPassword("Basic !!!not-base64")).toBeNull();
    expect(extractBasicPassword(`Basic ${btoa("nocolon")}`)).toBeNull();
  });
});

describe("timingSafeEqual", () => {
  it("is true only for an exact match", async () => {
    expect(await timingSafeEqual("hunter2", "hunter2")).toBe(true);
    expect(await timingSafeEqual("", "")).toBe(true);
  });

  it("is false for any mismatch, including different lengths", async () => {
    expect(await timingSafeEqual("hunter2", "hunter3")).toBe(false);
    expect(await timingSafeEqual("short", "longerstring")).toBe(false);
    expect(await timingSafeEqual("secret", "")).toBe(false);
  });
});
