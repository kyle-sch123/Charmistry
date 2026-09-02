import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_AUTHOR,
  computeRatingSummary,
  formatAuthorName,
  normaliseAuthorName,
  resolveAuthorName,
  REVIEW_BODY_MAX,
  REVIEW_NAME_MAX,
  REVIEW_TITLE_MAX,
  validateReviewInput,
} from "@/lib/reviews";
import type { Review } from "@/types";

function makeReview(overrides: Partial<Review>): Review {
  return {
    id: "r1",
    product_id: "p1",
    user_id: "u1",
    rating: 5,
    title: null,
    body: "Lovely piece.",
    author_name: "Emily S.",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("formatAuthorName", () => {
  it("returns first name + last initial", () => {
    expect(formatAuthorName("Emily", "Selman")).toBe("Emily S.");
  });
  it("uses first name alone when no surname", () => {
    expect(formatAuthorName("Hector", "")).toBe("Hector");
    expect(formatAuthorName("Hector", null)).toBe("Hector");
  });
  it("falls back to Anonymous with no first name", () => {
    expect(formatAuthorName(null, "Edwards")).toBe("Anonymous");
    expect(formatAuthorName("  ", "Edwards")).toBe("Anonymous");
  });
  it("trims and upper-cases the initial", () => {
    expect(formatAuthorName("  mark ", "  edwards ")).toBe("mark E.");
  });
});

describe("computeRatingSummary", () => {
  it("returns a zeroed summary for no reviews", () => {
    const s = computeRatingSummary([]);
    expect(s.average).toBe(0);
    expect(s.count).toBe(0);
    expect(s.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    expect(s.percentages).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  it("computes average, count and distribution", () => {
    const s = computeRatingSummary([
      makeReview({ rating: 5 }),
      makeReview({ rating: 4 }),
      makeReview({ rating: 5 }),
      makeReview({ rating: 2 }),
    ]);
    expect(s.count).toBe(4);
    expect(s.average).toBe(4); // (5+4+5+2)/4
    expect(s.distribution).toEqual({ 1: 0, 2: 1, 3: 0, 4: 1, 5: 2 });
    expect(s.percentages).toEqual({ 1: 0, 2: 25, 3: 0, 4: 25, 5: 50 });
  });

  it("rounds the average to two decimals", () => {
    const s = computeRatingSummary([
      makeReview({ rating: 5 }),
      makeReview({ rating: 4 }),
      makeReview({ rating: 4 }),
    ]);
    expect(s.average).toBe(4.33);
  });

  it("clamps and rounds out-of-range ratings into 1-5 buckets", () => {
    const s = computeRatingSummary([
      makeReview({ rating: 0 }),
      makeReview({ rating: 7 }),
    ]);
    expect(s.distribution).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 1 });
  });
});

describe("validateReviewInput", () => {
  it("accepts a valid review and trims fields", () => {
    const r = validateReviewInput({
      rating: 4,
      title: "  Great  ",
      body: "  Really happy with it  ",
    });
    expect(r).toEqual({
      ok: true,
      value: {
        rating: 4,
        title: "Great",
        body: "Really happy with it",
        name: null,
      },
    });
  });

  it("normalises an empty title to null", () => {
    const r = validateReviewInput({ rating: 5, title: "   ", body: "Nice" });
    expect(r.ok && r.value.title).toBeNull();
  });

  it("rejects non-integer or out-of-range ratings", () => {
    expect(validateReviewInput({ rating: 0, body: "x" })).toEqual({
      ok: false,
      error: "invalid_rating",
    });
    expect(validateReviewInput({ rating: 6, body: "x" })).toEqual({
      ok: false,
      error: "invalid_rating",
    });
    expect(validateReviewInput({ rating: 3.5, body: "x" })).toEqual({
      ok: false,
      error: "invalid_rating",
    });
    expect(validateReviewInput({ rating: "5", body: "x" })).toEqual({
      ok: false,
      error: "invalid_rating",
    });
  });

  it("rejects an empty body", () => {
    expect(validateReviewInput({ rating: 5, body: "   " })).toEqual({
      ok: false,
      error: "empty_body",
    });
    expect(validateReviewInput({ rating: 5 })).toEqual({
      ok: false,
      error: "empty_body",
    });
  });

  it("rejects an over-long body or title", () => {
    expect(
      validateReviewInput({ rating: 5, body: "a".repeat(REVIEW_BODY_MAX + 1) }),
    ).toEqual({ ok: false, error: "body_too_long" });
    expect(
      validateReviewInput({
        rating: 5,
        title: "a".repeat(REVIEW_TITLE_MAX + 1),
        body: "ok",
      }),
    ).toEqual({ ok: false, error: "title_too_long" });
  });
});

describe("normaliseAuthorName", () => {
  it("trims and collapses runs of whitespace", () => {
    expect(normaliseAuthorName("  Thandi   M.  ")).toBe("Thandi M.");
  });
  it("strips control characters, newlines included", () => {
    expect(normaliseAuthorName("Bea\nvan\tNiekerk")).toBe("Bea van Niekerk");
    expect(normaliseAuthorName("Sam\u0000\u007f")).toBe("Sam");
  });
  it("returns an empty string for blank or non-string input", () => {
    expect(normaliseAuthorName("   ")).toBe("");
    expect(normaliseAuthorName(undefined)).toBe("");
    expect(normaliseAuthorName(null)).toBe("");
    expect(normaliseAuthorName(42)).toBe("");
  });
});

describe("resolveAuthorName", () => {
  it("prefers the typed name over the profile snapshot", () => {
    expect(
      resolveAuthorName("  Nomsa  ", { first_name: "Emily", last_name: "Selman" }),
    ).toBe("Nomsa");
  });

  it("falls back to the profile snapshot when the name box is blank", () => {
    // The pre-name-box behaviour for an account, held steady: leaving the box
    // empty must not rename an existing reviewer to Anonymous.
    expect(
      resolveAuthorName("", { first_name: "Emily", last_name: "Selman" }),
    ).toBe("Emily S.");
    expect(
      resolveAuthorName(null, { first_name: "Emily", last_name: "Selman" }),
    ).toBe("Emily S.");
  });

  it("falls back to Anonymous for a guest with no name", () => {
    expect(resolveAuthorName("", null)).toBe(ANONYMOUS_AUTHOR);
    expect(resolveAuthorName(undefined)).toBe(ANONYMOUS_AUTHOR);
    expect(resolveAuthorName("   ", null)).toBe(ANONYMOUS_AUTHOR);
  });

  it("falls back to Anonymous when a signed-in profile has no name on file", () => {
    expect(resolveAuthorName("", { first_name: null, last_name: null })).toBe(
      ANONYMOUS_AUTHOR,
    );
  });

  it("lets a guest name themselves", () => {
    expect(resolveAuthorName("Jo", null)).toBe("Jo");
  });
});

describe("validateReviewInput — name", () => {
  it("normalises a submitted name", () => {
    const r = validateReviewInput({
      rating: 5,
      body: "Lovely",
      name: "  Thandi   M. ",
    });
    expect(r.ok && r.value.name).toBe("Thandi M.");
  });

  it("normalises a blank or missing name to null", () => {
    const blank = validateReviewInput({ rating: 5, body: "Lovely", name: "  " });
    expect(blank.ok && blank.value.name).toBeNull();
    const missing = validateReviewInput({ rating: 5, body: "Lovely" });
    expect(missing.ok && missing.value.name).toBeNull();
  });

  it("rejects an over-long name", () => {
    expect(
      validateReviewInput({
        rating: 5,
        body: "Lovely",
        name: "a".repeat(REVIEW_NAME_MAX + 1),
      }),
    ).toEqual({ ok: false, error: "name_too_long" });
  });

  it("measures the name AFTER normalising, so padding can't trip the limit", () => {
    const padded = `   ${"a".repeat(REVIEW_NAME_MAX)}   `;
    const r = validateReviewInput({ rating: 5, body: "Lovely", name: padded });
    expect(r.ok).toBe(true);
  });
});
