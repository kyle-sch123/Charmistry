/**
 * Helpers for POST /api/analytics/collect, kept out of the route file (Next
 * route modules may only export handlers and route config).
 *
 * `buildIngestArgs` turns a validated tracker batch into the snake_case shape
 * `analytics_ingest` stores: it parses the user agent, adds Cloudflare's
 * coarse location, and classifies every touch on the server (the browser's
 * own idea of the traffic source is never trusted).
 */

import { classifyTouch } from "../channel";
import type { AnyEventPayload } from "../events";
import type { IngestArgs } from "../rpc";
import { touchFingerprint } from "../touch";
import type { CollectPayload } from "../types";
import { parseUserAgent } from "../ua";
import { pageTypeFor } from "../url";
import type { Geo } from "./geo";

function requestUrl(request: Request): URL | null {
  try {
    return new URL(request.url);
  } catch {
    return null;
  }
}

/**
 * Same-origin only: the Origin host must match the host the browser asked for
 * (the Host header; behind Cloudflare and in `next dev` bound to 0.0.0.0 the
 * request URL's own host can differ), or, with no usable Origin, Sec-Fetch-Site
 * must say same-origin.
 */
export function isSameOrigin(request: Request): boolean {
  const url = requestUrl(request);
  if (!url) return false;
  const hosts = new Set(
    [request.headers.get("x-forwarded-host"), request.headers.get("host"), url.host]
      .filter((h): h is string => Boolean(h))
      .map((h) => h.split(",")[0].trim().toLowerCase()),
  );
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    try {
      return hosts.has(new URL(origin).host.toLowerCase());
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export function isLocalRequest(request: Request): boolean {
  const host = requestUrl(request)?.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function eventValue(e: AnyEventPayload): number | null {
  const p = e.props as Record<string, unknown>;
  if (e.name === "view_item" || e.name === "add_to_cart" || e.name === "remove_from_cart") {
    return Math.round(Number(p.price) * Number(p.quantity) * 100) / 100;
  }
  return typeof p.value === "number" ? p.value : null;
}

export function buildIngestArgs(
  payload: CollectPayload,
  userAgent: string | null,
  geo: Geo,
): IngestArgs | null {
  if (payload.pageViews.length === 0 && payload.events.length === 0 && payload.touches.length === 0) {
    return null;
  }
  const agent = parseUserAgent(userAgent, payload.session.deviceHint);
  const times = [
    payload.session.startedAt,
    ...payload.touches.map((t) => t.at),
    ...payload.pageViews.map((v) => v.at),
    ...payload.events.map((e) => e.at),
  ];
  const lastActivity = times.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));

  return {
    visitor: { id: payload.visitorId, seen_at: lastActivity },
    session: {
      id: payload.session.id,
      started_at: payload.session.startedAt,
      last_activity_at: lastActivity,
      landing_path: payload.session.landingPath,
      landing_page_type: pageTypeFor(payload.session.landingPath).pageType,
      device: agent.device,
      browser: agent.browser,
      os: agent.os,
      country: geo.country,
      city: geo.city,
    },
    touches: payload.touches.map((t) => {
      const c = classifyTouch(t);
      return {
        id: t.id,
        at: t.at,
        fingerprint: touchFingerprint(t),
        landing_path: t.landingPath,
        referrer_host: t.referrerHost,
        utm_source: t.utmSource,
        utm_medium: t.utmMedium,
        utm_campaign: t.utmCampaign,
        utm_content: t.utmContent,
        utm_term: t.utmTerm,
        utm_id: t.utmId,
        click_id_type: t.clickIdType,
        click_id: t.clickId,
        in_app: t.inApp,
        source: c.source,
        medium: c.medium,
        campaign: c.campaign,
        content: t.utmContent,
        term: t.utmTerm,
        channel: c.channel,
        inferred: c.inferred,
        excluded: c.excluded,
      };
    }),
    page_views: payload.pageViews.map((v) => ({
      id: v.id,
      viewed_at: v.at,
      path: v.path,
      page_type: v.pageType,
      product_slug: v.productSlug,
      title: v.title,
      engaged_ms: v.engagedMs,
      max_scroll_pct: v.maxScrollPct,
    })),
    events: payload.events.map((e) => {
      const p = e.props as Record<string, unknown>;
      return {
        id: e.id,
        page_view_id: e.pageViewId,
        name: e.name,
        occurred_at: e.at,
        product_id: typeof p.product_id === "string" ? p.product_id : null,
        product_slug: typeof p.product_slug === "string" ? p.product_slug : null,
        value: eventValue(e),
        props: p,
      };
    }),
  };
}
