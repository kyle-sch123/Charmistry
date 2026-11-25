/**
 * Touches: one record per campaign arrival (UTM tags, an ad click id, an
 * external referrer, or as a last resort an in-app browser hint).
 *
 * Why touches, not new sessions: Google Analytics 4 keeps a session going when
 * a visitor arrives again from a new campaign within 30 minutes; it doesn't
 * split it (that was Universal Analytics). We match GA4, so a mid-session
 * campaign is recorded as a touch. A session's acquisition is its first touch;
 * an order is attributed to the last non-direct touch within 90 days.
 *
 * Privacy: only allow-listed parameters are read (`utm_*` and six click ids).
 * Everything else in the query string, including Klaviyo's `_kx` identity
 * token, is ignored and never stored.
 */

import { detectInApp, normaliseSource, normaliseUtm } from "./normalise";
import { newId, isUuid } from "./ids";
import { referrerHostOf, sanitisePath } from "./url";
import type { ClickIdType, InAppPlatform, Touch } from "./types";
import { CLICK_ID_TYPES, LIMITS, TOUCH_DEDUPE_MS } from "./types";

const CLICK_ID_RE = /^[A-Za-z0-9._~+/=-]{1,200}$/;
const HOST_RE = /^[a-z0-9.-]{1,200}$/;
const IN_APP: readonly InAppPlatform[] = ["instagram", "facebook", "tiktok"];

export type NavigationKind = "navigate" | "reload" | "back_forward" | "prerender";

function hasSignal(t: Omit<Touch, "id" | "at" | "landingPath">): boolean {
  return Boolean(
    t.utmSource ||
      t.utmMedium ||
      t.utmCampaign ||
      t.utmContent ||
      t.utmTerm ||
      t.utmId ||
      t.clickId ||
      t.referrerHost ||
      t.inApp,
  );
}

function cleanClickId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return CLICK_ID_RE.test(s) ? s : null;
}

/**
 * Build the candidate touch for a full page load, or null for a direct visit.
 * Only called on the landing hit; client-side navigations never build one.
 */
export function touchFromLanding(i: {
  search: string;
  pathname: string;
  referrer: string;
  ownHost: string;
  userAgent: string | null;
  now: Date;
  id?: string;
}): Touch | null {
  const params = new URLSearchParams(i.search);
  let clickIdType: ClickIdType | null = null;
  let clickId: string | null = null;
  for (const type of CLICK_ID_TYPES) {
    const v = cleanClickId(params.get(type));
    if (v) {
      clickIdType = type;
      clickId = v;
      break;
    }
  }
  const base = {
    referrerHost: referrerHostOf(i.referrer, i.ownHost),
    utmSource: normaliseUtm(params.get("utm_source")),
    utmMedium: normaliseUtm(params.get("utm_medium")),
    utmCampaign: normaliseUtm(params.get("utm_campaign")),
    utmContent: normaliseUtm(params.get("utm_content")),
    utmTerm: normaliseUtm(params.get("utm_term")),
    utmId: normaliseUtm(params.get("utm_id")),
    clickIdType,
    clickId,
    inApp: null as InAppPlatform | null,
  };
  const noUtm =
    !base.utmSource &&
    !base.utmMedium &&
    !base.utmCampaign &&
    !base.utmContent &&
    !base.utmTerm &&
    !base.utmId;
  if (noUtm && !clickId && !base.referrerHost) {
    base.inApp = detectInApp(i.userAgent);
  }
  if (!hasSignal(base)) return null;
  return {
    id: i.id ?? newId(),
    at: i.now.toISOString(),
    landingPath: sanitisePath(i.pathname),
    ...base,
  };
}

/** Identical campaign arrivals within 30 minutes are one touch. */
export function touchFingerprint(t: Touch): string {
  return [
    t.utmSource,
    t.utmMedium,
    t.utmCampaign,
    t.utmContent,
    t.utmTerm,
    t.utmId,
    t.clickIdType,
    t.clickId,
    t.referrerHost,
    t.inApp,
  ]
    .map((v) => v ?? "")
    .join("|");
}

export function shouldRecordTouch(
  candidate: Touch | null,
  last: { fingerprint: string; at: string } | null,
  now: number,
  navigationType: NavigationKind,
): boolean {
  if (!candidate) return false;
  if (navigationType === "reload" || navigationType === "back_forward") return false;
  if (last && last.fingerprint === touchFingerprint(candidate)) {
    const lastAt = Date.parse(last.at);
    if (Number.isFinite(lastAt) && now - lastAt < TOUCH_DEDUPE_MS) return false;
  }
  return true;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/**
 * Server-side re-validation of a touch sent by the browser. Every field is
 * re-normalised; anything malformed is dropped. Returns null if the result is
 * not a touch at all.
 */
export function sanitiseTouch(raw: unknown): Touch | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isUuid(r.id)) return null;
  const atMs = typeof r.at === "string" ? Date.parse(r.at) : NaN;
  if (!Number.isFinite(atMs)) return null;

  const hostRaw = str(r.referrerHost)?.trim().toLowerCase() ?? null;
  const referrerHost = hostRaw && HOST_RE.test(hostRaw) ? hostRaw : null;
  const typeRaw = str(r.clickIdType);
  let clickIdType: ClickIdType | null =
    typeRaw && (CLICK_ID_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as ClickIdType)
      : null;
  let clickId = clickIdType ? cleanClickId(r.clickId) : null;
  if (!clickId) clickIdType = null;
  if (!clickIdType) clickId = null;
  const inAppRaw = str(r.inApp);
  const inApp =
    inAppRaw && (IN_APP as readonly string[]).includes(inAppRaw)
      ? (inAppRaw as InAppPlatform)
      : null;

  const fields = {
    referrerHost,
    utmSource: normaliseUtm(str(r.utmSource)),
    utmMedium: normaliseUtm(str(r.utmMedium)),
    utmCampaign: normaliseUtm(str(r.utmCampaign)),
    utmContent: normaliseUtm(str(r.utmContent)),
    utmTerm: normaliseUtm(str(r.utmTerm)),
    utmId: normaliseUtm(str(r.utmId)),
    clickIdType,
    clickId,
    inApp,
  };
  if (!hasSignal(fields)) return null;
  return {
    id: (r.id as string).toLowerCase(),
    at: new Date(atMs).toISOString(),
    landingPath: sanitisePath(str(r.landingPath) ?? "/"),
    ...fields,
  };
}

/**
 * Counts towards order attribution. Mirrors `isAttributable(classifyTouch(t))`
 * without shipping the classifier to the browser: a touch is Direct only when
 * it has no source, medium, click id, referrer or in-app hint (a campaign name
 * alone), and transactional email is never credited.
 */
export function isAttributableTouch(t: Touch): boolean {
  if (normaliseSource(t.utmSource) === "transactional") return false;
  return Boolean(t.utmSource || t.utmMedium || t.clickIdType || t.referrerHost || t.inApp);
}

/** Cap for one stored value (UTM values are already capped at 100 by normaliseUtm). */
export const TOUCH_VALUE_MAX = LIMITS.maxString;
