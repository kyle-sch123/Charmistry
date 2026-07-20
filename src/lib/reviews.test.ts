import { describe, expect, it } from "vitest";
import {
  computeRatingSummary,
  formatAuthorName,
  REVIEW_BODY_MAX,
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
      value: { rating: 4, title: "Great", body: "Really happy with it" },
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
