/**
 * Shared types and limits for first-party customer-journey analytics.
 *
 * Why this exists: the browser tracker, the collect API, the checkout
 * attribution snapshot and the admin dashboard all exchange the same shapes.
 * Keeping them in one dependency-free module (safe to import from client and
 * server code) means the four sides can never drift apart silently.
 *
 * Privacy rules baked into these shapes (POPIA):
 *   - no email, name, phone or IP address is ever part of an analytics payload;
 *   - a Touch carries only allow-listed campaign fields (never `_kx`, never a
 *     raw query string);
 *   - under GPC / DNT the tracker uses session-only ids (`sessionOnly`).
 */

export type DeviceClass = "mobile" | "tablet" | "desktop";

export type PageType =
  | "home"
  | "shop"
  | "listing"
  | "product"
  | "checkout"
  | "checkout_success"
  | "checkout_cancelled"
  | "account"
  | "info"
  | "other";

export type ClickIdType =
  | "gclid"
  | "gbraid"
  | "wbraid"
  | "fbclid"
  | "ttclid"
  | "msclkid";

export const CLICK_ID_TYPES: readonly ClickIdType[] = [
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "ttclid",
  "msclkid",
];

export type InAppPlatform = "instagram" | "facebook" | "tiktok";

/** One acquisition touch, built on a full page load only. Allow-listed fields only; never `_kx`. */
export interface Touch {
  /** uuid, client-generated */
  id: string;
  /** ISO-8601 UTC */
  at: string;
  /** path only, never a query string */
  landingPath: string;
  /** already filtered (own host and PayFast removed) */
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  utmId: string | null;
  clickIdType: ClickIdType | null;
  /** raw, case preserved, <= 200 chars */
  clickId: string | null;
  /** only set when there is no UTM, click id or referrer */
  inApp: InAppPlatform | null;
}

export interface PageViewPayload {
  id: string;
  at: string;
  path: string;
  pageType: PageType;
  productSlug: string | null;
  title: string | null;
  engagedMs: number;
  maxScrollPct: number;
}

/** Re-exported here so payload consumers need only one import. */
export type { AnyEventPayload } from "./events";
import type { AnyEventPayload } from "./events";

export interface CollectPayload {
  v: 1;
  visitorId: string;
  /** true under GPC/DNT: ids live in sessionStorage only */
  sessionOnly: boolean;
  session: {
    id: string;
    startedAt: string;
    landingPath: string;
    deviceHint: DeviceClass | null;
  };
  /** this session's touches not yet sent (0..3) */
  touches: Touch[];
  pageViews: PageViewPayload[];
  events: AnyEventPayload[];
  /** E2E override; honoured only on localhost or outside production */
  debug?: true;
}

/** Sent by CheckoutClient as `attribution` in the /api/checkout body. */
export interface CheckoutAttribution {
  visitorId: string;
  sessionId: string;
  /** earliest attributable touch kept on this device (<= 13 months) */
  firstTouch: Touch | null;
  /** last attributable touch within 90 days */
  lastTouch: Touch | null;
  /** attributable touches within 90 days */
  touchCount: number;
  /** null under GPC/DNT or when older than 90 days */
  fbclid: { value: string; at: string } | null;
  /** `_fbp` cookie; null under GPC/DNT */
  fbp: string | null;
  /** `_fbc` cookie if the pixel set one; null under GPC/DNT */
  fbc: string | null;
}

export const LIMITS = {
  maxBodyBytes: 32_768,
  maxPageViews: 20,
  maxEvents: 50,
  maxTouches: 3,
  maxString: 200,
  maxUtm: 100,
  maxTitle: 120,
  maxPath: 300,
  maxTerm: 100,
  maxEngagedMs: 21_600_000,
  futureSkewMs: 300_000,
  maxAgeMs: 86_400_000,
} as const;

export const SESSION_TIMEOUT_MS = 30 * 60_000;
export const TOUCH_DEDUPE_MS = 30 * 60_000;
export const ATTRIBUTION_WINDOW_MS = 90 * 86_400_000;
/** Touches older than this are dropped on the device (matches the 13-month DB purge). */
export const TOUCH_RETENTION_MS = 396 * 86_400_000;
export const SMALL_SAMPLE_SESSIONS = 30;

/** localStorage (or sessionStorage under GPC/DNT) */
export const STORAGE_KEY = "charmistry-analytics";
/** "1" = record nothing at all (the /privacy opt-out) */
export const OPT_OUT_KEY = "charmistry-analytics-off";
/** "1" = allow the tracker under webdriver (local E2E only) */
export const DEBUG_KEY = "charmistry-analytics-debug";
/** Must equal the admin gate's KEY_STORAGE: a browser that has used the admin key is staff and never tracked. */
export const STAFF_KEY = "charmistry-admin-key";
export const COLLECT_PATH = "/api/analytics/collect";
