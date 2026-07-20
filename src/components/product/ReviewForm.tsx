/**
 * Review submission form. Posts to /api/reviews, which enforces the purchase
 * gate server-side — this component just surfaces the outcome. Follows the
 * SettingsClient submit-state convention (idle | saving | saved) with an
 * inline error banner.
 *
 * Auth is checked before the form is shown (see ReviewSection); a 401/403 from
 * the API is still handled here as defence in depth.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { StarRatingInput } from "./Stars";
import { REVIEW_BODY_MAX, REVIEW_TITLE_MAX } from "@/lib/reviews";
import type { Review } from "@/types";

interface Props {
  productId: string;
  /** Existing review to edit, if the signed-in user already reviewed the piece. */
  existing?: Review | null;
  onSaved: (review: Review) => void;
  onCancel: () => void;
}

type SaveState = "idle" | "saving";

const ERROR_COPY: Record<string, string> = {
  unauthorised: "Your session expired — please sign in again.",
  not_purchased: "Only verified buyers can review this piece.",
  invalid_rating: "Please choose a rating from 1 to 5 stars.",
  empty_body: "Please write a few words about the piece.",
  body_too_long: "Your review is a little too long.",
  title_too_long: "Your title is a little too long.",
};

export default function ReviewForm({
  productId,
  existing,
  onSaved,
  onCancel,
}: Props) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saveState === "saving") return;

    if (rating < 1) {
      setError(ERROR_COPY.invalid_rating);
      return;
    }
    if (!body.trim()) {
      setError(ERROR_COPY.empty_body);
      return;
    }

    setSaveState("saving");
    setError(null);
    setNeedsSignIn(false);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          rating,
          title: title.trim() || null,
          body: body.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { review?: Review; error?: string }
        | null;

      if (!res.ok) {
        if (res.status === 401) setNeedsSignIn(true);
        setError(ERROR_COPY[data?.error ?? ""] ?? "Could not submit your review. Please try again.");
        setSaveState("idle");
        return;
      }
      if (data?.review) onSaved(data.review);
    } catch {
      setError("Could not submit your review. Please try again.");
      setSaveState("idle");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 border border-ink/10 bg-paper-warm/40 p-6"
    >
      <div className="mb-5">
        <label className="block text-[11px] tracking-[0.2em] uppercase text-ink/55 font-body mb-2">
          Your rating
        </label>
        <StarRatingInput value={rating} onChange={setRating} disabled={saveState === "saving"} />
      </div>

      <div className="mb-5">
        <label
          htmlFor="review-title"
          className="block text-[11px] tracking-[0.2em] uppercase text-ink/55 font-body mb-2"
        >
          Title <span className="text-ink/35 normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          maxLength={REVIEW_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saveState === "saving"}
          className="w-full border border-ink/15 bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none focus:border-ink/40 transition-colors"
          placeholder="Sum up your thoughts"
        />
      </div>

      <div className="mb-5">
        <label
          htmlFor="review-body"
          className="block text-[11px] tracking-[0.2em] uppercase text-ink/55 font-body mb-2"
        >
          Your review
        </label>
        <textarea
          id="review-body"
          value={body}
          maxLength={REVIEW_BODY_MAX}
          onChange={(e) => setBody(e.target.value)}
          disabled={saveState === "saving"}
          rows={4}
          className="w-full border border-ink/15 bg-paper px-4 py-3 font-body text-sm leading-relaxed text-ink outline-none focus:border-ink/40 transition-colors resize-y"
          placeholder="What did you love about this piece?"
        />
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-700 font-body">
          {error}
          {needsSignIn && (
            <>
              {" "}
              <Link href="/login?next=" className="underline hover:text-red-800">
                Sign in
              </Link>
            </>
          )}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saveState === "saving"}
          className="px-6 py-3 bg-ink text-paper text-[11px] tracking-[0.2em] uppercase font-body hover:bg-ink/85 transition-colors disabled:opacity-60"
        >
          {saveState === "saving"
            ? "Submitting…"
            : existing
              ? "Update review"
              : "Submit review"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saveState === "saving"}
          className="px-6 py-3 text-[11px] tracking-[0.2em] uppercase font-body text-ink/60 hover:text-ink transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
