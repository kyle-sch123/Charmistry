/**
 * Server-side validation of a tracker batch posted to /api/analytics/collect.
 *
 * Why so strict: the collect endpoint is public. Everything is re-derived or
 * re-checked here: ids must be uuids, paths are re-sanitised (no query
 * strings), touches are re-normalised, unknown events and unknown prop keys
 * are dropped, numbers are clamped, search terms that look like emails are
 * redacted, and timestamps outside [now - 24h, now + 5min] become "now".
 * The browser is never trusted to classify anything.
 */

import {
  ADD_TO_BAG_SOURCES,
  isEventName,
  PROMO_KEYS,
  scrubSearchTerm,
  type AddToBagSource,
  type AnyEventPayload,
  type EventName,
  type ItemProps,
  type PromoKey,
} from "./events";
import { isUuid } from "./ids";
import { sanitiseTouch } from "./touch";
import type { CollectPayload, DeviceClass, PageType, PageViewPayload } from "./types";
import { LIMITS } from "./types";
import { pageTypeFor, sanitisePath } from "./url";

export type ValidationResult =
  | { ok: true; payload: CollectPayload }
  | { ok: false; reason: string };

const DEVICE_HINTS: readonly DeviceClass[] = ["mobile", "tablet", "desktop"];
const PAGE_TYPES: readonly PageType[] = [
  "home",
  "shop",
  "listing",
  "product",
  "checkout",
  "checkout_success",
  "checkout_cancelled",
  "account",
  "info",
  "other",
];

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return s.length > 0 ? s : null;
}

function num(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function clampTime(v: unknown, now: number): string {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  if (!Number.isFinite(t) || t < now - LIMITS.maxAgeMs || t > now + LIMITS.futureSkewMs) {
    return new Date(now).toISOString();
  }
  return new Date(t).toISOString();
}

function item(p: Record<string, unknown>): ItemProps | null {
  if (!isUuid(p.product_id)) return null;
  const name = text(p.name, LIMITS.maxString);
  if (!name) return null;
  return {
    product_id: (p.product_id as string).toLowerCase(),
    product_slug: text(p.product_slug, LIMITS.maxString),
    name,
    variant: text(p.variant, 50),
    size: text(p.size, 50),
    category: text(p.category, 50),
    price: num(p.price, 0, 1e6) ?? 0,
    quantity: Math.round(num(p.quantity, 1, 99) ?? 1),
  };
}

function kind(v: unknown): "welcome" | "code" {
  return v === "welcome" ? "welcome" : "code";
}

/** Known keys only, coerced and clamped. Returns null to drop the event. */
function cleanProps(name: EventName, raw: unknown): Record<string, unknown> | null {
  const p = obj(raw) ?? {};
  switch (name) {
    case "view_item":
    case "remove_from_cart":
      return item(p) as Record<string, unknown> | null;
    case "add_to_cart": {
      const base = item(p);
      const source = p.source as AddToBagSource;
      if (!base || !ADD_TO_BAG_SOURCES.includes(source)) return null;
      const list = PAGE_TYPES.includes(p.list as PageType) ? (p.list as PageType) : null;
      return { ...base, source, list, group_id: isUuid(p.group_id) ? p.group_id : null };
    }
    case "view_cart":
    case "begin_checkout":
      return {
        item_count: Math.round(num(p.item_count, 0, 99) ?? 0),
        value: num(p.value, 0, 1e6) ?? 0,
      };
    case "checkout_email_entered":
      return {};
    case "shipping_method_selected": {
      const method = text(p.method, 40);
      return method ? { method } : null;
    }
    case "discount_applied": {
      const code = text(p.code, 40);
      return code
        ? { code: code.toUpperCase(), kind: kind(p.kind), amount: num(p.amount, 0, 1e6) ?? 0 }
        : null;
    }
    case "discount_rejected":
      return { reason: text(p.reason, 40) ?? "unknown", kind: kind(p.kind) };
    case "checkout_submitted":
      return {
        value: num(p.value, 0, 1e6) ?? 0,
        item_count: Math.round(num(p.item_count, 0, 99) ?? 0),
        method: text(p.method, 40) ?? "unknown",
        promo: text(p.promo, 40),
      };
    case "checkout_error":
      return { reason: text(p.reason, 60) ?? "unknown" };
    case "purchase_confirmed":
      return isUuid(p.order_id)
        ? { order_id: (p.order_id as string).toLowerCase(), value: num(p.value, 0, 1e6) ?? 0 }
        : null;
    case "search": {
      const term = typeof p.term === "string" ? scrubSearchTerm(p.term, LIMITS.maxTerm) : "";
      return term ? { term, results: Math.round(num(p.results, 0, 1000) ?? 0) } : null;
    }
    case "promo_click":
      return PROMO_KEYS.includes(p.promo as PromoKey) ? { promo: p.promo } : null;
    case "newsletter_signup":
      return p.outcome === "success" || p.outcome === "duplicate" || p.outcome === "error"
        ? { outcome: p.outcome }
        : null;
    case "wishlist_add":
    case "wishlist_remove":
      return isUuid(p.product_id) ? { product_id: (p.product_id as string).toLowerCase() } : null;
    case "review_submitted": {
      const rating = num(p.rating, 1, 5);
      return isUuid(p.product_id) && rating !== null
        ? { product_id: (p.product_id as string).toLowerCase(), rating: Math.round(rating) }
        : null;
    }
    default:
      return null;
  }
}

export function validateCollectPayload(raw: unknown, now: Date): ValidationResult {
  const nowMs = now.getTime();
  const r = obj(raw);
  if (!r || r.v !== 1) return { ok: false, reason: "version" };
  if (!isUuid(r.visitorId)) return { ok: false, reason: "visitor" };
  const s = obj(r.session);
  if (!s || !isUuid(s.id)) return { ok: false, reason: "session" };

  const touchesRaw = Array.isArray(r.touches) ? r.touches : [];
  const viewsRaw = Array.isArray(r.pageViews) ? r.pageViews : [];
  const eventsRaw = Array.isArray(r.events) ? r.events : [];
  if (
    touchesRaw.length > LIMITS.maxTouches ||
    viewsRaw.length > LIMITS.maxPageViews ||
    eventsRaw.length > LIMITS.maxEvents
  ) {
    return { ok: false, reason: "too_many" };
  }

  const touches = touchesRaw
    .map((t) => sanitiseTouch(t))
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .map((t) => ({ ...t, at: clampTime(t.at, nowMs) }));

  const pageViews: PageViewPayload[] = [];
  for (const v of viewsRaw) {
    const pv = obj(v);
    if (!pv || !isUuid(pv.id)) continue;
    const path = sanitisePath(typeof pv.path === "string" ? pv.path : "/");
    const { pageType, productSlug } = pageTypeFor(path);
    pageViews.push({
      id: (pv.id as string).toLowerCase(),
      at: clampTime(pv.at, nowMs),
      path,
      pageType,
      productSlug,
      title: text(pv.title, LIMITS.maxTitle),
      engagedMs: Math.round(num(pv.engagedMs, 0, LIMITS.maxEngagedMs) ?? 0),
      maxScrollPct: Math.round(num(pv.maxScrollPct, 0, 100) ?? 0),
    });
  }
  const viewIds = new Set(pageViews.map((v) => v.id));

  const events: AnyEventPayload[] = [];
  for (const e of eventsRaw) {
    const ev = obj(e);
    if (!ev || !isUuid(ev.id) || !isEventName(ev.name)) continue;
    const props = cleanProps(ev.name, ev.props);
    if (!props) continue;
    const pvId = isUuid(ev.pageViewId) ? (ev.pageViewId as string).toLowerCase() : null;
    events.push({
      id: (ev.id as string).toLowerCase(),
      name: ev.name,
      at: clampTime(ev.at, nowMs),
      pageViewId: pvId && viewIds.has(pvId) ? pvId : null,
      props,
    } as AnyEventPayload);
  }

  const hint = DEVICE_HINTS.includes(s.deviceHint as DeviceClass) ? (s.deviceHint as DeviceClass) : null;
  return {
    ok: true,
    payload: {
      v: 1,
      visitorId: (r.visitorId as string).toLowerCase(),
      sessionOnly: r.sessionOnly === true,
      session: {
        id: (s.id as string).toLowerCase(),
        startedAt: clampTime(s.startedAt, nowMs),
        landingPath: sanitisePath(typeof s.landingPath === "string" ? s.landingPath : "/"),
        deviceHint: hint,
      },
      touches,
      pageViews,
      events,
      ...(r.debug === true ? { debug: true as const } : {}),
    },
  };
}
