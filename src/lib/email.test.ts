import { describe, expect, it } from "vitest";
import { canonicaliseEmail } from "@/lib/email";

describe("canonicaliseEmail", () => {
  it("trims and lowercases", () => {
    expect(canonicaliseEmail("  Bob@Example.COM ")).toBe("bob@example.com");
  });

  it("strips plus-addressing", () => {
    expect(canonicaliseEmail("bob+newsletter@example.com")).toBe("bob@example.com");
  });

  it("rewrites googlemail.com to gmail.com", () => {
    expect(canonicaliseEmail("bob@googlemail.com")).toBe("bob@gmail.com");
  });

  it("removes dots in the gmail local-part", () => {
    expect(canonicaliseEmail("b.o.b@gmail.com")).toBe("bob@gmail.com");
    expect(canonicaliseEmail("b.o.b@googlemail.com")).toBe("bob@gmail.com");
  });

  it("keeps dots for non-gmail domains", () => {
    expect(canonicaliseEmail("b.o.b@example.com")).toBe("b.o.b@example.com");
  });

  it("returns the trimmed input when there is no @", () => {
    expect(canonicaliseEmail("  NotAnEmail ")).toBe("notanemail");
  });
});
