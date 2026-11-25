/**
 * Filter state lives in the URL (?range=30d&device=mobile&compare=1 ...), so
 * Back, refresh and bookmarks keep the view, and the range carries over from
 * the overview to Journeys. Defaults are left out of the URL.
 */

import { FUNNEL_STEPS, type FunnelStepKey } from "@/lib/analytics/events";
import { RANGE_KEYS, type RangeKey } from "@/lib/analytics/range";
import type { DeviceClass } from "@/lib/analytics/types";

export interface BaseFilters {
  range: RangeKey;
  from: string | null;
  to: string | null;
  device: DeviceClass | null;
  compare: boolean;
}

export type Outcome = "any" | "paid" | "bag" | "browsed";

export interface JourneyFilters extends BaseFilters {
  outcome: Outcome;
  channel: string | null;
  campaign: string | null;
  step: FunnelStepKey | null;
  q: string | null;
  page: number;
}

const DEVICES: readonly DeviceClass[] = ["mobile", "tablet", "desktop"];
const OUTCOMES: readonly Outcome[] = ["any", "paid", "bag", "browsed"];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

type Params = Pick<URLSearchParams, "get">;

export function readBase(p: Params): BaseFilters {
  const range = RANGE_KEYS.includes(p.get("range") as RangeKey) ? (p.get("range") as RangeKey) : "30d";
  const from = p.get("from");
  const to = p.get("to");
  const device = DEVICES.includes(p.get("device") as DeviceClass) ? (p.get("device") as DeviceClass) : null;
  return {
    range,
    from: range === "custom" && from && YMD.test(from) ? from : null,
    to: range === "custom" && to && YMD.test(to) ? to : null,
    device,
    compare: p.get("compare") !== "0",
  };
}

export function readJourneys(p: Params): JourneyFilters {
  const outcome = OUTCOMES.includes(p.get("outcome") as Outcome) ? (p.get("outcome") as Outcome) : "any";
  const step = FUNNEL_STEPS.includes(p.get("step") as FunnelStepKey) ? (p.get("step") as FunnelStepKey) : null;
  const page = Math.max(1, Math.floor(Number(p.get("page")) || 1));
  const text = (k: string) => p.get(k)?.trim() || null;
  return { ...readBase(p), outcome, channel: text("channel"), campaign: text("campaign"), step, q: text("q"), page };
}

/** Query string for a set of filters (defaults omitted). */
export function toQuery(f: Partial<JourneyFilters>): string {
  const q = new URLSearchParams();
  if (f.range && f.range !== "30d") q.set("range", f.range);
  if (f.range === "custom") {
    if (f.from) q.set("from", f.from);
    if (f.to) q.set("to", f.to);
  }
  if (f.device) q.set("device", f.device);
  if (f.compare === false) q.set("compare", "0");
  if (f.outcome && f.outcome !== "any") q.set("outcome", f.outcome);
  if (f.channel) q.set("channel", f.channel);
  if (f.campaign) q.set("campaign", f.campaign);
  if (f.step) q.set("step", f.step);
  if (f.q) q.set("q", f.q);
  if (f.page && f.page > 1) q.set("page", String(f.page));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Query for the admin API: always explicit, including defaults. */
export function apiQuery(f: Partial<JourneyFilters>, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  q.set("range", f.range ?? "30d");
  if (f.range === "custom") {
    if (f.from) q.set("from", f.from);
    if (f.to) q.set("to", f.to);
  }
  q.set("device", f.device ?? "all");
  q.set("compare", f.compare === false ? "0" : "1");
  if (f.outcome) q.set("outcome", f.outcome);
  if (f.channel) q.set("channel", f.channel);
  if (f.campaign) q.set("campaign", f.campaign);
  if (f.step) q.set("step", f.step);
  if (f.q) q.set("q", f.q);
  if (f.page) q.set("page", String(f.page));
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return `?${q.toString()}`;
}
