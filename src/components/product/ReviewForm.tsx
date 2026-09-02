/**
 * Review submission form. Posts to /api/reviews, which accepts a review with or
 * without a session — this component just surfaces the outcome. Follows the
 * SettingsClient submit-state convention (idle | saving | saved) with an
 * inline error banner.
 *
 * The name box is optional for everybody. Left blank it posts as "Anonymous"
 * for a guest, or keeps a signed-in reviewer's profile "First L." snapshot —
 * the server owns that rule (resolveAuthorName), so the placeholder here only
 * has to be honest about the guest case, which is the one being chosen.
 */

"use client";

import { useState } from "react";
import { StarRatingInput } from "./Stars";
import {
  ANONYMOUS_AUTHOR,
  REVIEW_BODY_MAX,
  REVIEW_NAME_MAX,
  REVIEW_TITLE_MAX,
} from "@/lib/reviews";
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
  invalid_rating: "Please choose a rating from 1 to 5 stars.",
  empty_body: "Please write a few words about the piece.",
  body_too_long: "Your review is a little too long.",
  title_too_long: "Your title is a little too long.",
  name_too_long: "That name is a little too long.",
};

export default function ReviewForm({
  productId,
  existing,
  onSaved,
  onCancel,
}: Props) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  // Editing keeps whatever name the review already carries, so re-saving an
  // existing review never silently renames its author.
  const [name, setName] = useState(existing?.author_name ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

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
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          rating,
          name: name.trim() || null,
          title: title.trim() || null,
          body: body.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { review?: Review; error?: string }
        | null;

      if (!res.ok) {
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
          htmlFor="review-name"
          className="block text-[11px] tracking-[0.2em] uppercase text-ink/55 font-body mb-2"
        >
          Your name{" "}
          <span className="text-ink/35 normal-case tracking-normal">
            (optional)
          </span>
        </label>
        <input
          id="review-name"
          type="text"
          value={name}
          maxLength={REVIEW_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          disabled={saveState === "saving"}
          autoComplete="name"
          className="w-full border border-ink/15 bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none focus:border-ink/40 transition-colors"
          placeholder={ANONYMOUS_AUTHOR}
        />
        <p className="mt-2 font-body text-xs text-ink/45">
          Leave this blank to post as {ANONYMOUS_AUTHOR}.
        </p>
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
        <p className="mb-4 text-sm text-red-700 font-body">{error}</p>
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
