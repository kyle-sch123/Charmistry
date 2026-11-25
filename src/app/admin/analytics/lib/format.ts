/**
 * Number and date formatting for the analytics pages, in the site's South
 * African format: money through the shop's own `formatPrice` (R1 240), counts
 * and percentages through Intl en-ZA (1 204, 2,1%), durations as "1m 48s",
 * and dates in SAST (UTC+2, no daylight saving, so a fixed offset is exact).
 */

import { formatPrice } from "@/lib/utils";

const SAST_MS = 2 * 3_600_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const COUNT = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });
const DECIMAL1 = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

export function money(n: number): string {
  const rounded = Math.round((Number(n) || 0) * 100) / 100;
  return formatPrice(rounded >= 100 ? Math.round(rounded) : rounded);
}

/** Axis ticks: R0, R2k, R4k, R1,5k. */
export function moneyCompact(n: number): string {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000) return `R${DECIMAL1.format(v / 1000)}k`;
  return `R${COUNT.format(v)}`;
}

export function count(n: number): string {
  return COUNT.format(Number(n) || 0);
}

/** A fraction as a percentage: 0.021 -> "2,1%". */
export function percent(fraction: number, maxDigits = 1): string {
  const f = Number(fraction) || 0;
  return new Intl.NumberFormat("en-ZA", {
    style: "percent",
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: 0,
  }).format(f);
}

/** Percentage points: 0.004 -> "0,4 pts". */
export function points(fractionDelta: number): string {
  return `${DECIMAL1.format(Math.abs(fractionDelta) * 100)} pts`;
}

/** "22s", "1m 48s", "1h 5m". */
export function duration(ms: number): string {
  const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function sast(iso: string): Date | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + SAST_MS) : null;
}

/** "27 Oct" */
export function dateShort(iso: string): string {
  const d = sast(iso);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` : "";
}

/** "12 Nov 2026" */
export function dateLong(iso: string): string {
  const d = sast(iso);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "";
}

/** "14:02" */
export function time(iso: string): string {
  const d = sast(iso);
  return d
    ? `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
    : "";
}

/** "25 Nov, 14:02" */
export function dateTime(iso: string): string {
  return `${dateShort(iso)}, ${time(iso)}`;
}

/** "27 Oct – 25 Nov 2026" from SAST YYYY-MM-DD dates. */
export function rangeCaption(fromDate: string, toDate: string): string {
  const f = new Date(`${fromDate}T00:00:00Z`);
  const t = new Date(`${toDate}T00:00:00Z`);
  if (!Number.isFinite(f.getTime()) || !Number.isFinite(t.getTime())) return "";
  const fs = `${f.getUTCDate()} ${MONTHS[f.getUTCMonth()]}`;
  const ts = `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;
  return fromDate === toDate ? `${ts} ${t.getUTCFullYear()}` : `${fs} – ${ts} ${t.getUTCFullYear()}`;
}

/** "2 min ago", "just now". */
export function ago(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const mins = Math.floor((now - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours} h ago` : dateShort(iso);
}

/** Order number as customers see it: #ABCD1234. */
export function orderRef(shortId: string | null | undefined): string {
  return shortId ? `#${shortId}` : "";
}
