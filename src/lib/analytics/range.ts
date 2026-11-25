/**
 * Date ranges for the analytics dashboard, in South African time.
 *
 * Why fixed-offset maths: Africa/Johannesburg is UTC+2 all year with no
 * daylight saving, so a SAST day always starts at 22:00 UTC the day before.
 * Every range is half-open, [from, to), in UTC ISO strings, so the SQL side can
 * compare timestamps directly.
 */

export const TZ = "Africa/Johannesburg";
export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";
export const RANGE_KEYS: readonly RangeKey[] = ["today", "7d", "30d", "90d", "custom"];

export interface ResolvedRange {
  key: RangeKey;
  /** ISO UTC, [from, to) */
  from: string;
  to: string;
  /** null when compare is off */
  prevFrom: string | null;
  prevTo: string | null;
  granularity: "hour" | "day";
  buckets: number;
  /** YYYY-MM-DD in SAST, inclusive (for captions) */
  fromDate: string;
  toDate: string;
  prevFromDate: string | null;
  prevToDate: string | null;
}

export type RangeError = { error: "invalid_range" | "end_before_start" | "too_long" };

const HOUR = 3_600_000;
const DAY = 86_400_000;
const SAST_OFFSET = 2 * HOUR;
export const MAX_CUSTOM_DAYS = 366;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC ms of 00:00 SAST on the SAST day containing `ms`. */
export function sastDayStart(ms: number): number {
  return Math.floor((ms + SAST_OFFSET) / DAY) * DAY - SAST_OFFSET;
}

/** YYYY-MM-DD of the SAST day containing `ms`. */
export function sastYmd(ms: number): string {
  return new Date(ms + SAST_OFFSET).toISOString().slice(0, 10);
}

/** UTC ms of 00:00 SAST on a YYYY-MM-DD date, or null if malformed. */
function parseYmd(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = YMD.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const utc = Date.UTC(y, mo - 1, d);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d
  )
    return null;
  return utc - SAST_OFFSET;
}

function build(
  key: RangeKey,
  from: number,
  to: number,
  compare: boolean,
  prevFrom: number,
  prevTo: number,
  granularity: "hour" | "day",
  buckets: number,
): ResolvedRange {
  return {
    key,
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    prevFrom: compare ? new Date(prevFrom).toISOString() : null,
    prevTo: compare ? new Date(prevTo).toISOString() : null,
    granularity,
    buckets,
    fromDate: sastYmd(from),
    toDate: sastYmd(to - 1),
    prevFromDate: compare ? sastYmd(prevFrom) : null,
    prevToDate: compare ? sastYmd(prevTo - 1) : null,
  };
}

export function resolveRange(
  i: { range: RangeKey; from?: string | null; to?: string | null; compare: boolean },
  now: Date,
): ResolvedRange | RangeError {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return { error: "invalid_range" };
  const today = sastDayStart(nowMs);

  if (i.range === "today") {
    return build("today", today, nowMs, i.compare, today - DAY, nowMs - DAY, "hour", 24);
  }
  if (i.range === "7d" || i.range === "30d" || i.range === "90d") {
    const n = i.range === "7d" ? 7 : i.range === "30d" ? 30 : 90;
    const from = today - (n - 1) * DAY;
    return build(i.range, from, nowMs, i.compare, from - n * DAY, nowMs - n * DAY, "day", n);
  }
  if (i.range !== "custom") return { error: "invalid_range" };

  const from = parseYmd(i.from);
  const toStart = parseYmd(i.to);
  if (from === null || toStart === null) return { error: "invalid_range" };
  if (toStart < from) return { error: "end_before_start" };
  const days = Math.round((toStart - from) / DAY) + 1;
  if (days > MAX_CUSTOM_DAYS) return { error: "too_long" };
  if (from >= nowMs) return { error: "invalid_range" };
  const to = Math.min(toStart + DAY, nowMs);
  const span = to - from;
  const hourly = span <= DAY;
  const buckets = hourly ? 24 : Math.ceil((sastDayStart(to - 1) - from) / DAY) + 1;
  return build("custom", from, to, i.compare, from - span, from, hourly ? "hour" : "day", buckets);
}

export function isRangeError(r: ResolvedRange | RangeError): r is RangeError {
  return "error" in r;
}
