/**
 * Order attribution: how a paying customer found the shop.
 *
 * At checkout the browser sends its tracker's view (`CheckoutAttribution`:
 * first touch, last non-direct touch within 90 days, Meta's browser ids).
 * `/api/checkout` hands it to `recordOrderAttribution`, which re-validates and
 * re-classifies everything (the browser is never trusted) and stores one
 * snapshot row per order through `analytics_attribute_order`. Later the PayFast
 * ITN, a server-to-server call with no browser attached, reads it back with
 * `readCapiContext` so Meta's Conversions API gets `_fbp`, `_fbc` and the user
 * agent.
 *
 * Both are best-effort by design: they never throw, give up after 1.5s, and
 * do nothing before migration 014 is applied, so checkout and the ITN behave
 * exactly as before whatever happens here.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetaCapiBrowserContext } from "@/lib/meta-capi";
import { createServerSupabase } from "@/lib/supabase-server";
import { classifyTouch } from "../channel";
import { isUuid } from "../ids";
import { callAnalyticsRpc, type ClassifiedTouch } from "../rpc";
import { logAnalyticsErrorOnce } from "../setup";
import { sanitiseTouch } from "../touch";
import type { CheckoutAttribution, Touch } from "../types";
import { ATTRIBUTION_WINDOW_MS } from "../types";
import { readGeo } from "./geo";

export const ATTRIBUTION_TIMEOUT_MS = 1500;
const FB_COOKIE_RE = /^fb[.][0-9][.][0-9]+[.][\w.~+/=-]{1,180}$/;
const FBCLID_RE = /^[A-Za-z0-9._~+/=-]{1,200}$/;

function fbCookie(v: unknown): string | null {
  return typeof v === "string" && v.length <= 200 && FB_COOKIE_RE.test(v) ? v : null;
}

/** Strict re-validation of the browser's attribution claim. Null if unusable. */
export function parseCheckoutAttribution(raw: unknown): CheckoutAttribution | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!isUuid(r.visitorId) || !isUuid(r.sessionId)) return null;
  const count = Number(r.touchCount);
  let fbclid: CheckoutAttribution["fbclid"] = null;
  const f = r.fbclid as Record<string, unknown> | null;
  if (f && typeof f === "object" && typeof f.value === "string" && FBCLID_RE.test(f.value)) {
    const at = typeof f.at === "string" ? Date.parse(f.at) : NaN;
    if (Number.isFinite(at)) fbclid = { value: f.value, at: new Date(at).toISOString() };
  }
  return {
    visitorId: (r.visitorId as string).toLowerCase(),
    sessionId: (r.sessionId as string).toLowerCase(),
    firstTouch: sanitiseTouch(r.firstTouch),
    lastTouch: sanitiseTouch(r.lastTouch),
    touchCount: Number.isFinite(count) ? Math.min(100, Math.max(0, Math.round(count))) : 0,
    fbclid,
    fbp: fbCookie(r.fbp),
    fbc: fbCookie(r.fbc),
  };
}

/** Stored form of a touch, or null when it must not be credited (transactional email, direct). */
export function toClassifiedTouch(t: Touch | null): ClassifiedTouch | null {
  if (!t) return null;
  const c = classifyTouch(t);
  if (c.excluded || c.channel === "Direct") return null;
  return {
    at: t.at,
    landing_path: t.landingPath,
    source: c.source,
    medium: c.medium,
    campaign: c.campaign,
    content: t.utmContent,
    term: t.utmTerm,
    channel: c.channel,
    inferred: c.inferred,
    click_id_type: t.clickIdType,
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/**
 * Store the order's attribution snapshot. Never rejects; resolves after at
 * most ATTRIBUTION_TIMEOUT_MS. Does nothing when the browser sent nothing
 * (tracking off: opt-out, staff, or an old client).
 */
export function recordOrderAttribution(i: {
  supabase: SupabaseClient;
  orderId: string;
  raw: unknown;
  request: Request;
}): Promise<void> {
  const run = async () => {
    const a = parseCheckoutAttribution(i.raw);
    if (!a) return;
    const ua = i.request.headers.get("user-agent");
    const { error } = await callAnalyticsRpc(
      i.supabase,
      "attributeOrder",
      {
        order_id: i.orderId,
        visitor_id: a.visitorId,
        session_id: a.sessionId,
        first_touch: toClassifiedTouch(a.firstTouch),
        last_touch: toClassifiedTouch(a.lastTouch),
        touch_count: a.touchCount,
        fbclid: a.fbclid?.value ?? null,
        fbclid_at: a.fbclid?.at ?? null,
        fbp: a.fbp,
        fbc: a.fbc,
        user_agent: ua ? ua.slice(0, 400) : null,
        country: readGeo(i.request).country,
      },
      { timeoutMs: ATTRIBUTION_TIMEOUT_MS },
    );
    if (error) logAnalyticsErrorOnce("attribute_order", error);
  };
  let p: Promise<void>;
  try {
    p = run();
  } catch {
    return Promise.resolve();
  }
  return withTimeout(p, ATTRIBUTION_TIMEOUT_MS, undefined);
}

/**
 * Meta's browser identifiers for an order, for the ITN's Conversions API call.
 * Uses the stored `_fbc`; failing that, builds one from an ad click id seen in
 * the last 90 days (`fb.1.<first seen ms>.<fbclid>`, Meta's documented format).
 */
export function readCapiContext(orderId: string, now = Date.now()): Promise<MetaCapiBrowserContext | null> {
  const run = async (): Promise<MetaCapiBrowserContext | null> => {
    if (!isUuid(orderId)) return null;
    const supabase = createServerSupabase();
    const { data, error } = await callAnalyticsRpc(
      supabase,
      "capiContext",
      { order_id: orderId },
      { timeoutMs: ATTRIBUTION_TIMEOUT_MS },
    );
    if (error) {
      logAnalyticsErrorOnce("capi_context", error);
      return null;
    }
    if (!data) return null;
    let fbc = data.fbc ?? null;
    if (!fbc && data.fbclid && data.fbclid_at) {
      const at = Date.parse(data.fbclid_at);
      if (Number.isFinite(at) && now - at <= ATTRIBUTION_WINDOW_MS) fbc = `fb.1.${at}.${data.fbclid}`;
    }
    const context: MetaCapiBrowserContext = {
      fbp: data.fbp ?? null,
      fbc,
      clientUserAgent: data.user_agent ?? null,
    };
    return context.fbp || context.fbc || context.clientUserAgent ? context : null;
  };
  let p: Promise<MetaCapiBrowserContext | null>;
  try {
    p = run();
  } catch {
    return Promise.resolve(null);
  }
  return withTimeout(p, ATTRIBUTION_TIMEOUT_MS, null);
}
