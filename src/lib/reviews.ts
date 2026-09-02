/**
 * Review helpers — pure logic shared by the API route, the read layer and the
 * UI. Kept free of Supabase/React imports so it is unit-testable in isolation
 * (see reviews.test.ts), mirroring the discounts.ts / discounts.test.ts split.
 *
 * Four responsibilities:
 * - formatAuthorName(): the public "First L." snapshot taken from a profile.
 * - resolveAuthorName(): the whole display-name rule — typed name wins, then
 *   the profile snapshot, then "Anonymous".
 * - computeRatingSummary(): the aggregate behind both the summary bars and the
 *   products.rating / products.review_count cache the API writes.
 * - validateReviewInput(): normalises + bounds the submitted name/rating/
 *   title/body.
 */

import type { RatingSummary, Review, StarRating } from "@/types";

export const REVIEW_BODY_MAX = 2000;
export const REVIEW_TITLE_MAX = 120;
export const REVIEW_NAME_MAX = 60;

/** Display name for a review left without one. author_name is never empty. */
export const ANONYMOUS_AUTHOR = "Anonymous";

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
  if (!first) return ANONYMOUS_AUTHOR;
  const initial = last ? `${last[0].toUpperCase()}.` : "";
  return initial ? `${first} ${initial}` : first;
}

/**
 * Clean a reviewer-supplied display name for storage. Collapses whitespace and
 * drops control characters (including newlines) so a name can neither be
 * blank-but-not-empty nor break the single-line layout of a review card. The
 * result is bounded by the caller — see validateReviewInput.
 *
 * Returns "" for anything that normalises to nothing, which is the signal the
 * reviewer left the box blank.
 */
export function normaliseAuthorName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The display name a review is stored with, in priority order:
 *
 *   1. the name the reviewer typed into the (optional) name box;
 *   2. their profile "First L." snapshot, when they were signed in — this is
 *      what every review written before the name box existed used, so leaving
 *      the box blank keeps an account's reviews looking exactly as they did;
 *   3. "Anonymous".
 *
 * Guests only ever reach 1 or 3, which is the rule the form promises: leave it
 * blank and you post as Anonymous.
 */
export function resolveAuthorName(
  submitted: string | null | undefined,
  profile?: { first_name?: string | null; last_name?: string | null } | null,
): string {
  const typed = normaliseAuthorName(submitted);
  if (typed) return typed;
  if (profile) return formatAuthorName(profile.first_name, profile.last_name);
  return ANONYMOUS_AUTHOR;
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
  /** Normalised name, or null when the reviewer left the box blank. */
  name: string | null;
}

export type ReviewInputError =
  | "invalid_rating"
  | "empty_body"
  | "body_too_long"
  | "title_too_long"
  | "name_too_long";

export type ReviewInputResult =
  | { ok: true; value: ReviewInput }
  | { ok: false; error: ReviewInputError };

/**
 * Validate + normalise a submitted review. Rating must be an integer 1–5;
 * body must be non-empty after trimming and within REVIEW_BODY_MAX; an
 * optional title and an optional display name are cleaned and bounded.
 * Returns the cleaned value or the first error encountered.
 *
 * A blank name is not an error — it normalises to null, and the caller turns
 * that into the profile snapshot or "Anonymous" via resolveAuthorName().
 */
export function validateReviewInput(raw: {
  rating?: unknown;
  title?: unknown;
  body?: unknown;
  name?: unknown;
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

  // Bounded AFTER normalising, so padding a name with whitespace can't push an
  // otherwise-fine name over the limit.
  const name = normaliseAuthorName(raw.name);
  if (name.length > REVIEW_NAME_MAX) {
    return { ok: false, error: "name_too_long" };
  }

  return {
    ok: true,
    value: { rating, title: titleRaw || null, body, name: name || null },
  };
}
