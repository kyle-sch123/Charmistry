/**
 * Turns the database's raw section results into the numbers the dashboard
 * shows: KPI tiles with comparisons and sparklines, the traffic charts, and
 * the product flags ("Promote these" / "Worth a closer look").
 *
 * Why here, not in SQL: these are small O(rows) transforms that are easier to
 * test as pure functions, and keeping them out of the database lets the SQL
 * stay plain aggregation. Rates are fractions (0..1); the UI formats them.
 */

import type { Kpi, ProductFlag, ProductsData, SummaryData, TrafficData, TrafficPoint } from "../api";
import type { ResolvedRange } from "../range";
import type { Counts, ProductsRaw, SummaryRaw } from "../rpc";

export function safeRate(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Linear-interpolated percentile, p in [0, 1]. */
export function percentile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (s.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

const ZERO: Counts = {
  sessions: 0,
  visitors: 0,
  adds: 0,
  engaged_ms: 0,
  bounces: 0,
  conversions: 0,
  orders: 0,
  revenue: 0,
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function counts(c: Partial<Counts> | null | undefined): Counts {
  const r = { ...ZERO };
  if (!c) return r;
  for (const k of Object.keys(ZERO) as (keyof Counts)[]) r[k] = num(c[k]);
  return r;
}

/** One Counts per bucket index 0..n-1 (missing buckets are zero). */
export function fillBuckets(buckets: (Partial<Counts> & { i: number })[] | undefined, n: number): Counts[] {
  const out = Array.from({ length: n }, () => ({ ...ZERO }));
  for (const b of buckets ?? []) {
    const i = Number(b.i);
    if (Number.isInteger(i) && i >= 0 && i < n) out[i] = counts(b);
  }
  return out;
}

function kpi(value: number, previous: number | null, series: number[], sample: number): Kpi {
  return { value, previous, series, sample };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const SAST = 2 * HOUR_MS;

export function bucketLabels(range: ResolvedRange): { labels: string[]; longLabels: string[] } {
  const from = Date.parse(range.from);
  const labels: string[] = [];
  const longLabels: string[] = [];
  for (let i = 0; i < range.buckets; i++) {
    if (range.granularity === "hour") {
      const d = new Date(from + i * HOUR_MS + SAST);
      const hh = String(d.getUTCHours()).padStart(2, "0");
      labels.push(hh);
      longLabels.push(`${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hh}:00`);
    } else {
      const d = new Date(from + i * DAY_MS + SAST);
      labels.push(`${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`);
      longLabels.push(`${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`);
    }
  }
  return { labels, longLabels };
}

export function kpisFromSummary(
  raw: SummaryRaw,
  range: ResolvedRange,
): { summary: SummaryData; traffic: TrafficData } {
  const cur = counts(raw.current?.totals);
  const prev = raw.previous ? counts(raw.previous.totals) : null;
  const cb = fillBuckets(raw.current?.buckets, range.buckets);
  const pb = raw.previous ? fillBuckets(raw.previous.buckets, range.buckets) : null;

  const summary: SummaryData = {
    revenue: kpi(cur.revenue, prev?.revenue ?? null, cb.map((b) => b.revenue), cur.sessions),
    orders: kpi(cur.orders, prev?.orders ?? null, cb.map((b) => b.orders), cur.sessions),
    conversionRate: kpi(
      safeRate(cur.conversions, cur.sessions),
      prev ? safeRate(prev.conversions, prev.sessions) : null,
      cb.map((b) => safeRate(b.conversions, b.sessions)),
      cur.sessions,
    ),
    aov: kpi(
      safeRate(cur.revenue, cur.orders),
      prev ? safeRate(prev.revenue, prev.orders) : null,
      cb.map((b) => safeRate(b.revenue, b.orders)),
      cur.orders,
    ),
    sessions: kpi(cur.sessions, prev?.sessions ?? null, cb.map((b) => b.sessions), cur.sessions),
  };

  const point = (b: Counts): TrafficPoint => ({ sessions: b.sessions, revenue: b.revenue, orders: b.orders });
  const { labels, longLabels } = bucketLabels(range);
  const traffic: TrafficData = {
    engagement: {
      uniqueVisitors: kpi(cur.visitors, prev?.visitors ?? null, cb.map((b) => b.visitors), cur.sessions),
      addToBagRate: kpi(
        safeRate(cur.adds, cur.sessions),
        prev ? safeRate(prev.adds, prev.sessions) : null,
        cb.map((b) => safeRate(b.adds, b.sessions)),
        cur.sessions,
      ),
      avgEngagedMs: kpi(
        safeRate(cur.engaged_ms, cur.sessions),
        prev ? safeRate(prev.engaged_ms, prev.sessions) : null,
        cb.map((b) => safeRate(b.engaged_ms, b.sessions)),
        cur.sessions,
      ),
      bounceRate: kpi(
        safeRate(cur.bounces, cur.sessions),
        prev ? safeRate(prev.bounces, prev.sessions) : null,
        cb.map((b) => safeRate(b.bounces, b.sessions)),
        cur.sessions,
      ),
    },
    granularity: range.granularity,
    labels,
    longLabels,
    current: cb.map(point),
    previous: pb ? pb.map(point) : null,
  };
  return { summary, traffic };
}

export const FLAG_MIN_VIEWS = 20;

/**
 * Product flags over pieces with at least 20 views in range (§9):
 *   - Worth a closer look: views at or above the 75th percentile and
 *     view -> purchase at or below half the median;
 *   - Promote these: view -> purchase at least 1.5x the median, views at or
 *     below the median, and at least 2 orders.
 * No flags with fewer than 3 eligible pieces or a zero median. At most 3 each,
 * by views.
 */
export function computeProductFlags(raw: ProductsRaw): ProductsData {
  const rows = (raw.rows ?? []).map((r) => ({
    ...r,
    views: num(r.views),
    adds: num(r.adds),
    view_purchases: num(r.view_purchases),
    orders: num(r.orders),
    units: num(r.units),
    revenue: num(r.revenue),
  }));
  const eligible = rows.filter((r) => r.views >= FLAG_MIN_VIEWS);
  const vtp = (r: (typeof rows)[number]) => safeRate(r.view_purchases, r.views);
  const med = median(eligible.map(vtp));
  const empty = { promote: [] as ProductFlag[], closerLook: [] as ProductFlag[] };
  if (eligible.length < 3 || !med) {
    return { rows, medianViewToPurchase: med, eligible: eligible.length, flags: empty };
  }
  const p75Views = percentile(eligible.map((r) => r.views), 0.75) ?? Infinity;
  const medViews = median(eligible.map((r) => r.views)) ?? 0;
  const flag = (r: (typeof rows)[number]): ProductFlag => ({
    key: r.key,
    name: r.name,
    slug: r.slug,
    views: r.views,
    viewToPurchase: vtp(r),
  });
  const byViews = (a: { views: number }, b: { views: number }) => b.views - a.views;
  const closerLook = eligible
    .filter((r) => r.views >= p75Views && vtp(r) <= med / 2)
    .sort(byViews)
    .slice(0, 3)
    .map(flag);
  const promote = eligible
    .filter((r) => vtp(r) >= 1.5 * med && r.views <= medViews && r.orders >= 2)
    .sort(byViews)
    .slice(0, 3)
    .map(flag);
  return { rows, medianViewToPurchase: med, eligible: eligible.length, flags: { promote, closerLook } };
}
