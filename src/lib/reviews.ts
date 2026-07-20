/**
 * Review helpers — pure logic shared by the API route, the read layer and the
 * UI. Kept free of Supabase/React imports so it is unit-testable in isolation
 * (see reviews.test.ts), mirroring the discounts.ts / discounts.test.ts split.
 *
 * Three responsibilities:
 * - formatAuthorName(): the public "First L." display-name snapshot.
 * - computeRatingSummary(): the aggregate behind both the summary bars and the
 *   products.rating / products.review_count cache the API writes.
 * - validateReviewInput(): normalises + bounds the submitted rating/title/body.
 */

import type { RatingSummary, Review, StarRating } from "@/types";

export const REVIEW_BODY_MAX = 2000;
export const REVIEW_TITLE_MAX = 120;

const STAR_LEVELS: StarRating[] = [1, 2, 3, 4, 5];

/**
 * Public reviewer name: first name + last initial ("Emily S."). Falls back to
 * the first name alone, then to "Anonymous" when nothing usable is on file.
 */
export function formatAuthorName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (!first) return "Anonymous";
  const initial = last ? `${last[0].toUpperCase()}.` : "";
  return initial ? `${first} ${initial}` : first;
}

function emptyDistribution(): Record<StarRating, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

/**
 * Aggregate a piece's reviews into an average (2dp), a count, and per-star
 * distribution + percentages. Ratings are clamped/rounded into 1–5 so stray
 * values can never land outside the buckets.
 */
export function computeRatingSummary(
  reviews: Pick<Review, "rating">[],
): RatingSummary {
  const distribution = emptyDistribution();
  let total = 0;

  for (const { rating } of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(rating))) as StarRating;
    distribution[star] += 1;
    total += star;
  }

  const count = reviews.length;
  const average = count === 0 ? 0 : Math.round((total / count) * 100) / 100;

  const percentages = emptyDistribution();
  if (count > 0) {
    for (const star of STAR_LEVELS) {
      percentages[star] = Math.round((distribution[star] / count) * 100);
    }
  }

  return { average, count, distribution, percentages };
}

export interface ReviewInput {
  rating: number;
  title: string | null;
  body: string;
}

export type ReviewInputError =
  | "invalid_rating"
  | "empty_body"
  | "body_too_long"
  | "title_too_long";

export type ReviewInputResult =
  | { ok: true; value: ReviewInput }
  | { ok: false; error: ReviewInputError };

/**
 * Validate + normalise a submitted review. Rating must be an integer 1–5;
 * body must be non-empty after trimming and within REVIEW_BODY_MAX; an
 * optional title is trimmed and bounded. Returns the cleaned value or the
 * first error encountered.
 */
export function validateReviewInput(raw: {
  rating?: unknown;
  title?: unknown;
  body?: unknown;
}): ReviewInputResult {
  const rating = raw.rating;
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return { ok: false, error: "invalid_rating" };
  }

  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (!body) return { ok: false, error: "empty_body" };
  if (body.length > REVIEW_BODY_MAX) {
    return { ok: false, error: "body_too_long" };
  }

  const titleRaw = typeof raw.title === "string" ? raw.title.trim() : "";
  if (titleRaw.length > REVIEW_TITLE_MAX) {
    return { ok: false, error: "title_too_long" };
  }

  return {
    ok: true,
    value: { rating, title: titleRaw || null, body },
  };
}
