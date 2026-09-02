/**
 * Customer reviews block on the PDP — the summary + distribution bars on the
 * left, the review list on the right, mirroring the reference layout in
 * Charmistry's own palette (ink / paper / gold).
 *
 * Reviews are scoped to the piece (all metal variants), fetched server-side in
 * page.tsx and passed in as initialReviews. Writes go through ReviewForm →
 * /api/reviews, which needs neither an account nor a purchase; after a save we
 * re-pull the list via GET so the summary + bars update without a full reload.
 * Everyone gets the form — the "Write a review" CTA opens it for guests and
 * signed-in shoppers alike.
 *
 * Auth is still checked on mount, for two reasons that survive opening the
 * gate: a signed-in shopper's existing review has to load INTO the form rather
 * than becoming a second one (hence the CTA waiting on authChecked), and their
 * own review carries Edit and Delete on the card itself, where someone looks
 * for them. Delete is a two-step inline confirm (it can't be undone) and goes
 * to DELETE /api/reviews, which scopes the removal to the session user.
 *
 * Guest reviews have user_id null, and every comparison against the current
 * user has to rule that out first — signed out, currentUserId is null too, and
 * a bare equality check would hand a visitor Edit/Delete on the first stranger
 * who posted anonymously.
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
  // Deleting is irreversible, so the button asks once before it does it. An
  // inline confirm rather than a dialog: the whole interaction stays on the
  // card being deleted, which is the thing the shopper is looking at.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const summary = useMemo(() => computeRatingSummary(reviews), [reviews]);
  // Null-guarded on BOTH sides: a signed-out visitor (currentUserId null) must
  // never match a guest review (user_id null) and inherit its controls.
  const ownReview = useMemo(
    () =>
      currentUserId
        ? (reviews.find((r) => r.user_id === currentUserId) ?? null)
        : null,
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

  function handleSaved(saved: Review) {
    // Optimistically replace/insert, then reconcile with the server. The
    // same-author sweep only applies to a signed-in reviewer, who is held to
    // one review per piece; matching on a null user_id would drop every OTHER
    // guest's review from the list.
    setReviews((prev) => {
      const rest = prev.filter(
        (r) =>
          r.id !== saved.id &&
          !(saved.user_id !== null && r.user_id === saved.user_id),
      );
      return [saved, ...rest];
    });
    setShowForm(false);
    void refresh();
  }

  async function handleDelete() {
    if (!ownReview) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/reviews?productId=${productId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setDeleteError(
          res.status === 401
            ? "Your session expired — please sign in again."
            : "Couldn't remove your review. Please try again.",
        );
        return;
      }
      // Drop it locally so the summary and bars settle immediately, then
      // reconcile with the server.
      setReviews((prev) => prev.filter((r) => r.id !== ownReview.id));
      setConfirmingDelete(false);
      setShowForm(false);
      void refresh();
    } catch {
      setDeleteError("Couldn't remove your review. Please try again.");
    } finally {
      setDeleting(false);
    }
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
              Tell other customers what you think of this piece. No account and
              no order needed — add your name, or post anonymously.
            </p>

            {!showForm && (
              <>
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  disabled={!authChecked}
                  className="mt-5 w-full border border-ink/20 py-3 text-[11px] tracking-[0.2em] uppercase font-body text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
                >
                  {ownReview ? "Edit your review" : "Write a review"}
                </button>
                {/* A guest review can't be edited or removed afterwards — there
                    is no identity to scope that to. Better said before they
                    write it than discovered after. */}
                {authChecked && !currentUserId && (
                  <p className="mt-3 font-body text-xs text-ink/45 leading-relaxed">
                    Posting as a guest, you won&apos;t be able to change or
                    remove your review later.{" "}
                    <Link
                      href={`/login?next=/products/${productSlug}`}
                      className="underline hover:text-ink"
                    >
                      Sign in
                    </Link>{" "}
                    first if you&apos;d like to.
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
              {reviews.map((review) => {
                const isOwn = review.id === ownReview?.id;
                return (
                <li key={review.id} className="py-7 first:pt-0">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-10 h-10 rounded-full bg-ink/[0.06] text-ink/70 font-heading text-sm">
                      {initialsFor(review.author_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-semibold text-ink">
                        {review.author_name}
                        {isOwn && (
                          <span className="ml-2 font-normal text-[10px] tracking-[0.18em] uppercase text-ink/40">
                            Your review
                          </span>
                        )}
                      </p>
                      <Stars value={review.rating} className="mt-0.5" starClassName="w-3.5 h-3.5" />
                    </div>

                    {/* Own-review controls. They live on the card rather than
                        only behind "Edit your review" in the sidebar, because
                        the card is where a shopper looks for them. */}
                    {isOwn && !confirmingDelete && (
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setShowForm(true);
                          }}
                          className="font-body text-[11px] tracking-[0.14em] uppercase text-ink/50 hover:text-ink transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setConfirmingDelete(true);
                          }}
                          className="font-body text-[11px] tracking-[0.14em] uppercase text-ink/50 hover:text-red-700 transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    {isOwn && confirmingDelete && (
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-body text-[11px] text-ink/60">
                          Delete this review?
                        </span>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleting}
                          className="font-body text-[11px] tracking-[0.14em] uppercase text-red-700 hover:text-red-800 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {deleting ? "Removing…" : "Yes, delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(false)}
                          disabled={deleting}
                          className="font-body text-[11px] tracking-[0.14em] uppercase text-ink/50 hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {isOwn && deleteError && (
                    <p className="mt-3 font-body text-sm text-red-700">
                      {deleteError}
                    </p>
                  )}
                  {review.title && (
                    <p className="mt-4 font-body text-sm font-semibold text-ink">
                      {review.title}
                    </p>
                  )}
                  <p className="mt-2 font-body text-[15px] leading-relaxed text-ink/70 italic">
                    {review.body}
                  </p>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
