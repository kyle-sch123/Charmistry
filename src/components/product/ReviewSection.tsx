/**
 * Customer reviews block on the PDP — the summary + distribution bars on the
 * left, the review list on the right, mirroring the reference layout in
 * Charmistry's own palette (ink / paper / gold).
 *
 * Reviews are scoped to the piece (all metal variants), fetched server-side in
 * page.tsx and passed in as initialReviews. Writes go through ReviewForm →
 * /api/reviews (purchase-gated); after a save we re-pull the list via GET so
 * the summary + bars update without a full reload. The "Write a review" CTA
 * checks auth on mount: signed-out visitors get a sign-in prompt, signed-in
 * buyers get the form (a non-buyer is rejected by the API with a clear message).
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAuthBrowserClient } from "@/lib/auth/client";
import { computeRatingSummary } from "@/lib/reviews";
import type { Review, StarRating } from "@/types";
import { Stars, StarIcon } from "./Stars";
import ReviewForm from "./ReviewForm";

interface Props {
  productId: string;
  productSlug: string;
  initialReviews: Review[];
}

const STAR_ROWS: StarRating[] = [5, 4, 3, 2, 1];

function initialsFor(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
}

export default function ReviewSection({
  productId,
  productSlug,
  initialReviews,
}: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [signInPrompt, setSignInPrompt] = useState(false);

  const summary = useMemo(() => computeRatingSummary(reviews), [reviews]);
  const ownReview = useMemo(
    () => reviews.find((r) => r.user_id === currentUserId) ?? null,
    [reviews, currentUserId],
  );

  useEffect(() => {
    let active = true;
    getAuthBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setCurrentUserId(data.user?.id ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    try {
      const res = await fetch(`/api/reviews?productId=${productId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { reviews?: Review[] };
      if (data.reviews) setReviews(data.reviews);
    } catch {
      // Non-fatal: the optimistic list update already reflects the change.
    }
  }

  function handleWriteClick() {
    setSignInPrompt(false);
    if (!currentUserId) {
      setSignInPrompt(true);
      return;
    }
    setShowForm(true);
  }

  function handleSaved(saved: Review) {
    // Optimistically replace/insert, then reconcile with the server.
    setReviews((prev) => {
      const rest = prev.filter((r) => r.id !== saved.id && r.user_id !== saved.user_id);
      return [saved, ...rest];
    });
    setShowForm(false);
    void refresh();
  }

  return (
    <section
      id="reviews"
      className="mt-24 border-t border-ink/10 pt-16 scroll-mt-28"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        {/* Summary column */}
        <div className="lg:col-span-4">
          <h2 className="font-display text-3xl md:text-4xl font-light">
            Customer Reviews
          </h2>

          {summary.count > 0 ? (
            <>
              <div className="mt-4 flex items-center gap-3">
                <Stars value={summary.average} starClassName="w-5 h-5" />
                <span className="font-body text-sm text-ink/60">
                  Based on {summary.count}{" "}
                  {summary.count === 1 ? "review" : "reviews"}
                </span>
              </div>

              <div className="mt-6 space-y-2">
                {STAR_ROWS.map((star) => (
                  <div key={star} className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 w-10 text-ink/70 font-body">
                      {star}
                      <StarIcon className="w-3.5 h-3.5 text-gold" />
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-ink/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gold"
                        style={{ width: `${summary.percentages[star]}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-ink/50 font-body tabular-nums">
                      {summary.percentages[star]}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 font-body text-sm text-ink/60">
              No reviews yet — be the first to share your thoughts.
            </p>
          )}

          <div className="mt-10">
            <h3 className="font-heading text-lg text-ink">Share your thoughts</h3>
            <p className="mt-2 font-body text-sm text-ink/60 leading-relaxed">
              If you&rsquo;ve worn this piece, tell other customers what you
              think. Reviews are open to verified buyers.
            </p>

            {!showForm && (
              <>
                <button
                  type="button"
                  onClick={handleWriteClick}
                  disabled={!authChecked}
                  className="mt-5 w-full border border-ink/20 py-3 text-[11px] tracking-[0.2em] uppercase font-body text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
                >
                  {ownReview ? "Edit your review" : "Write a review"}
                </button>
                {signInPrompt && (
                  <p className="mt-3 font-body text-sm text-ink/70">
                    Please{" "}
                    <Link
                      href={`/login?next=/products/${productSlug}`}
                      className="underline hover:text-ink"
                    >
                      sign in
                    </Link>{" "}
                    to leave a review.
                  </p>
                )}
              </>
            )}
          </div>

          {showForm && (
            <ReviewForm
              productId={productId}
              existing={ownReview}
              onSaved={handleSaved}
              onCancel={() => setShowForm(false)}
            />
          )}
        </div>

        {/* Review list column */}
        <div className="lg:col-span-8">
          {reviews.length === 0 ? (
            <div className="h-full flex items-center justify-center border border-dashed border-ink/15 py-20">
              <p className="font-body text-sm text-ink/50">
                No reviews yet.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-ink/10">
              {reviews.map((review) => (
                <li key={review.id} className="py-7 first:pt-0">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-10 h-10 rounded-full bg-ink/[0.06] text-ink/70 font-heading text-sm">
                      {initialsFor(review.author_name)}
                    </span>
                    <div>
                      <p className="font-body text-sm font-semibold text-ink">
                        {review.author_name}
                      </p>
                      <Stars value={review.rating} className="mt-0.5" starClassName="w-3.5 h-3.5" />
                    </div>
                  </div>
                  {review.title && (
                    <p className="mt-4 font-body text-sm font-semibold text-ink">
                      {review.title}
                    </p>
                  )}
                  <p className="mt-2 font-body text-[15px] leading-relaxed text-ink/70 italic">
                    {review.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
