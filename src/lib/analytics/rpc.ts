/**
 * The only database call path for analytics: Postgres functions called with
 * `supabase.rpc(name, { p })`.
 *
 * Why RPC-only: every analytics function takes one `jsonb` argument and
 * returns `jsonb`, so (a) the SQL owns all aggregation, keeping Worker CPU
 * small, (b) the tables stay locked down (RLS on, no policies, no grants), and
 * (c) a local test harness can serve `/rest/v1/rpc/analytics_*` from an
 * in-memory Postgres with one generic handler. App code never calls
 * `.from("analytics_*")`.
 *
 * `callAnalyticsRpc` never throws: a timeout gives code "timeout", a thrown
 * error gives code "exception", and PostgREST/Postgres errors keep their code
 * (so `isAnalyticsMissingError` can spot an unapplied migration).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel } from "./channel";
import type { EventName, FunnelStepKey } from "./events";
import type { ClickIdType, DeviceClass, InAppPlatform, PageType } from "./types";

export const ANALYTICS_RPC = {
  ingest: "analytics_ingest",
  attributeOrder: "analytics_attribute_order",
  capiContext: "analytics_capi_context",
  summary: "analytics_summary",
  funnel: "analytics_funnel",
  acquisition: "analytics_acquisition",
  products: "analytics_products",
  promotions: "analytics_promotions",
  devices: "analytics_devices",
  pages: "analytics_pages",
  search: "analytics_search",
  when: "analytics_when",
  geography: "analytics_geography",
  health: "analytics_health",
  journeys: "analytics_journeys",
  journey: "analytics_journey",
  purge: "analytics_purge",
} as const;
export type RpcKey = keyof typeof ANALYTICS_RPC;

export interface RangeArgs {
  from: string;
  to: string;
  device: DeviceClass | null;
}
export interface CompareArgs extends RangeArgs {
  prev_from: string | null;
  prev_to: string | null;
  granularity: "hour" | "day";
}

/** Stored form of a classified touch (touch rows, order snapshot). */
export interface ClassifiedTouch {
  at: string;
  landing_path: string;
  source: string;
  medium: string;
  campaign: string | null;
  content: string | null;
  term: string | null;
  channel: Channel;
  inferred: boolean;
  click_id_type: ClickIdType | null;
}

export interface IngestTouch extends ClassifiedTouch {
  id: string;
  fingerprint: string;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_id: string | null;
  click_id: string | null;
  in_app: InAppPlatform | null;
  excluded: boolean;
}

export interface IngestArgs {
  visitor: { id: string; seen_at: string };
  session: {
    id: string;
    started_at: string;
    last_activity_at: string;
    landing_path: string;
    landing_page_type: PageType;
    device: DeviceClass;
    browser: string | null;
    os: string | null;
    country: string | null;
    city: string | null;
  };
  touches: IngestTouch[];
  page_views: {
    id: string;
    viewed_at: string;
    path: string;
    page_type: PageType;
    product_slug: string | null;
    title: string | null;
    engaged_ms: number;
    max_scroll_pct: number;
  }[];
  events: {
    id: string;
    page_view_id: string | null;
    name: EventName;
    occurred_at: string;
    product_id: string | null;
    product_slug: string | null;
    value: number | null;
    props: Record<string, unknown>;
  }[];
}
export interface IngestResult {
  skipped: boolean;
  touches: number;
  page_views: number;
  events: number;
}

export interface AttributeOrderArgs {
  order_id: string;
  visitor_id: string;
  session_id: string;
  first_touch: ClassifiedTouch | null;
  last_touch: ClassifiedTouch | null;
  touch_count: number;
  fbclid: string | null;
  fbclid_at: string | null;
  fbp: string | null;
  fbc: string | null;
  user_agent: string | null;
  country: string | null;
}
export interface CapiContextResult {
  fbclid: string | null;
  fbclid_at: string | null;
  fbp: string | null;
  fbc: string | null;
  user_agent: string | null;
}

export interface Counts {
  sessions: number;
  visitors: number;
  adds: number;
  engaged_ms: number;
  bounces: number;
  conversions: number;
  orders: number;
  revenue: number;
}
export interface SummaryRaw {
  current: { buckets: (Counts & { i: number })[]; totals: Counts };
  previous: { buckets: (Counts & { i: number })[]; totals: Counts } | null;
}
/** 7 counts, FUNNEL_STEPS order */
export interface FunnelRaw {
  current: number[];
  previous: number[] | null;
}
export interface MergedRow {
  key: string;
  sessions: number;
  adds: number;
  bounces: number;
  orders: number;
  revenue: number;
}
export interface OrderTouchRow {
  order_id: string;
  short_id: string;
  paid_at: string;
  total: number;
  tracked: boolean;
  session_id: string | null;
  first_touch: ClassifiedTouch | null;
  last_touch: ClassifiedTouch | null;
  touches: number;
  days_to_purchase: number | null;
}
export interface AcquisitionRaw {
  channels: MergedRow[];
  source_medium: MergedRow[];
  campaigns: (MergedRow & { source_medium: string })[];
  landing: MergedRow[];
  /** every paid order in range, newest first */
  orders: OrderTouchRow[];
  not_tracked: { orders: number; revenue: number };
  totals: { sessions: number; orders: number; revenue: number };
}
export interface ProductsRaw {
  rows: {
    key: string;
    name: string;
    slug: string | null;
    views: number;
    adds: number;
    view_purchases: number;
    orders: number;
    units: number;
    revenue: number;
  }[];
}
export interface PromotionsRaw {
  rows: { code: string; orders: number; revenue: number; discount: number }[];
  total_orders: number;
  no_promo: { orders: number; revenue: number };
  welcome: { issued: number; redeemed: number };
  banners: { clicks: number; sessions: number; orders: number; revenue: number };
}
export interface DevicesRaw {
  rows: { device: DeviceClass; sessions: number; orders: number; revenue: number }[];
  sticky: { mobile_adds: number; sticky_adds: number };
}
export interface PagesRaw {
  rows: {
    path: string;
    title: string | null;
    views: number;
    engaged_ms: number;
    exits: number;
  }[];
}
export interface SearchRaw {
  top: { term: string; searches: number; led_to_view: number }[];
  no_results: { term: string; searches: number; last_at: string }[];
}
/** [7][24]: Mon..Sun x 00..23 SAST, session starts */
export interface WhenRaw {
  cells: number[][];
}
export interface GeographyRaw {
  countries: { code: string; sessions: number; orders: number; revenue: number }[];
  cities:
    | { name: string; country: string; sessions: number; orders: number; revenue: number }[]
    | null;
}
export interface HealthRaw {
  ever: boolean;
  events_24h: number;
  page_views_24h: number;
  last_at: string | null;
}
export type JourneyOutcome = "paid" | "bag" | "browsed";
export interface JourneysArgs extends RangeArgs {
  outcome: "any" | JourneyOutcome;
  channel: string | null;
  campaign: string | null;
  step: FunnelStepKey | null;
  q: string | null;
  page: number;
  page_size: number;
}
export interface JourneyRowRaw {
  session_id: string;
  started_at: string;
  visitor_tag: string;
  customer_name: string | null;
  channel: Channel;
  source: string;
  medium: string;
  campaign: string | null;
  inferred: boolean;
  landing_path: string;
  pages: number;
  engaged_ms: number;
  outcome: JourneyOutcome;
  paid_total: number;
  order_short_id: string | null;
  bag_value: number;
}
export interface JourneysRaw {
  total: number;
  rows: JourneyRowRaw[];
  facets: { channels: string[]; campaigns: string[] };
}
export type TimelineItem =
  | {
      kind: "page";
      at: string;
      path: string;
      title: string | null;
      page_type: PageType;
      engaged_ms: number;
      scroll_pct: number;
    }
  | { kind: "event"; at: string; name: EventName; props: Record<string, unknown> }
  | { kind: "touch"; at: string; touch: ClassifiedTouch }
  | { kind: "order"; at: string; order_id: string; short_id: string; total: number };
export interface JourneyRaw {
  session: {
    id: string;
    started_at: string;
    ended_at: string;
    channel: Channel;
    source: string;
    medium: string;
    campaign: string | null;
    inferred: boolean;
    landing_path: string;
    device: DeviceClass;
    browser: string | null;
    os: string | null;
    country: string | null;
    city: string | null;
    pages: number;
    engaged_ms: number;
  };
  visitor: {
    tag: string;
    customer_name: string | null;
    first_seen_at: string;
    sessions: number;
    first_touch: ClassifiedTouch | null;
  };
  orders: {
    id: string;
    short_id: string;
    total: number;
    status: string;
    paid_at: string | null;
    session_id: string | null;
  }[];
  /** this session, chronological, capped at 500 */
  timeline: TimelineItem[];
  /** capped at 50 */
  sessions: {
    id: string;
    started_at: string;
    channel: Channel;
    source: string;
    medium: string;
    campaign: string | null;
    landing_path: string;
    pages: number;
    outcome: JourneyOutcome;
    paid_total: number;
    stitched: boolean;
  }[];
}
export interface PurgeResult {
  ran: boolean;
  sessions: number;
  touches: number;
  visitors: number;
}

export interface RpcIO {
  ingest: [IngestArgs, IngestResult];
  attributeOrder: [AttributeOrderArgs, null];
  capiContext: [{ order_id: string }, CapiContextResult | null];
  summary: [CompareArgs, SummaryRaw];
  funnel: [CompareArgs, FunnelRaw];
  acquisition: [RangeArgs, AcquisitionRaw];
  products: [RangeArgs, ProductsRaw];
  promotions: [RangeArgs, PromotionsRaw];
  devices: [RangeArgs, DevicesRaw];
  pages: [RangeArgs, PagesRaw];
  search: [RangeArgs, SearchRaw];
  when: [RangeArgs, WhenRaw];
  geography: [RangeArgs, GeographyRaw];
  health: [Record<string, never>, HealthRaw];
  journeys: [JourneysArgs, JourneysRaw];
  journey: [{ session_id: string }, JourneyRaw | null];
  purge: [Record<string, never>, PurgeResult];
}

export interface RpcError {
  code: string;
  message: string;
}

function isAbortLike(text: string): boolean {
  return /AbortError|TimeoutError|aborted/i.test(text);
}

export async function callAnalyticsRpc<K extends RpcKey>(
  client: SupabaseClient,
  key: K,
  p: RpcIO[K][0],
  opts?: { timeoutMs?: number },
): Promise<{ data: RpcIO[K][1] | null; error: RpcError | null }> {
  const timeoutMs = opts?.timeoutMs ?? 8000;
  try {
    let query = client.rpc(ANALYTICS_RPC[key], { p });
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      query = query.abortSignal(AbortSignal.timeout(timeoutMs));
    }
    const { data, error } = await query;
    if (error) {
      const message = typeof error.message === "string" ? error.message : "";
      const code =
        error.code && error.code.length > 0
          ? error.code
          : isAbortLike(message)
            ? "timeout"
            : "exception";
      return { data: null, error: { code, message } };
    }
    return { data: (data ?? null) as RpcIO[K][1] | null, error: null };
  } catch (e) {
    const err = e as { name?: string; message?: string } | null;
    const text = `${err?.name ?? ""} ${err?.message ?? ""}`;
    return {
      data: null,
      error: {
        code: isAbortLike(text) ? "timeout" : "exception",
        message: err?.message ?? "unknown",
      },
    };
  }
}
