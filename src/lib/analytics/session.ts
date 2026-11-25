/**
 * Session, engagement and attribution maths for the browser tracker. Pure, so
 * it is unit-tested without a browser.
 *
 * Sessions follow Google Analytics 4: a session ends after 30 minutes without
 * activity, and a new campaign does NOT split it (a mid-session campaign is
 * recorded as a touch instead). Engaged time counts only while the page is
 * visible, and a gap between activity marks counts for at most 30 seconds, so
 * a tab left open on the screen doesn't inflate "time on page".
 */

import { newId } from "./ids";
import { isAttributableTouch } from "./touch";
import type { Touch } from "./types";
import { ATTRIBUTION_WINDOW_MS, SESSION_TIMEOUT_MS, TOUCH_RETENTION_MS } from "./types";

export interface SessionState {
  id: string;
  startedAt: string;
  lastActivityAt: string;
  /** first page of the session (set by the tracker) */
  landingPath?: string;
}

export function nextSession(
  prev: SessionState | null,
  now: number,
  makeId: () => string = newId,
): { session: SessionState; isNew: boolean } {
  const last = prev ? Date.parse(prev.lastActivityAt) : NaN;
  if (!prev || !Number.isFinite(last) || now - last > SESSION_TIMEOUT_MS) {
    const at = new Date(now).toISOString();
    return { session: { id: makeId(), startedAt: at, lastActivityAt: at }, isNew: true };
  }
  const lastActivityAt = now > last ? new Date(now).toISOString() : prev.lastActivityAt;
  return { session: { ...prev, lastActivityAt }, isNew: false };
}

/** Longest gap between two activity marks that still counts as engaged. */
export const MAX_ENGAGED_GAP_MS = 30_000;

export interface EngagedState {
  engagedMs: number;
  /** last activity mark while visible; null while hidden */
  lastMark: number | null;
}

/**
 * Record an activity mark (or a visibility change) at `now`. While visible,
 * the time since the previous mark is added, capped at 30 seconds. Going
 * hidden banks the time so far and pauses the clock.
 */
export function accumulateEngaged(state: EngagedState, now: number, visible: boolean): EngagedState {
  let engagedMs = state.engagedMs;
  if (state.lastMark !== null && now > state.lastMark) {
    engagedMs += Math.min(now - state.lastMark, MAX_ENGAGED_GAP_MS);
  }
  return { engagedMs, lastMark: visible ? now : null };
}

/** Engaged time as of `now` without moving the mark (used when sending a snapshot). */
export function engagedSoFar(state: EngagedState, now: number): number {
  if (state.lastMark === null || now <= state.lastMark) return state.engagedMs;
  return state.engagedMs + Math.min(now - state.lastMark, MAX_ENGAGED_GAP_MS);
}

export interface AttributionPick {
  firstTouch: Touch | null;
  lastTouch: Touch | null;
  touchCount: number;
}

/**
 * Pick the touches an order is credited to: the last attributable touch in the
 * last 90 days (headline), the first attributable touch kept on this device
 * (up to 13 months), and how many attributable touches fall inside 90 days.
 */
export function pickAttribution(
  store: { touches: Touch[]; firstTouch: Touch | null },
  now: number,
): AttributionPick {
  const inWindow = (t: Touch, windowMs: number) => {
    const at = Date.parse(t.at);
    return Number.isFinite(at) && now - at <= windowMs && at <= now + 300_000;
  };
  const attributable = store.touches
    .filter(isAttributableTouch)
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const recent = attributable.filter((t) => inWindow(t, ATTRIBUTION_WINDOW_MS));
  const keptFirst =
    store.firstTouch && isAttributableTouch(store.firstTouch) && inWindow(store.firstTouch, TOUCH_RETENTION_MS)
      ? store.firstTouch
      : null;
  const firstTouch =
    keptFirst ?? attributable.find((t) => inWindow(t, TOUCH_RETENTION_MS)) ?? null;
  return {
    firstTouch,
    lastTouch: recent.length > 0 ? recent[recent.length - 1] : null,
    touchCount: recent.length,
  };
}
