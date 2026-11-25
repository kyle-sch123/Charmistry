/**
 * The admin analytics overview: filters in, one result per dashboard section
 * out.
 *
 * Why one request with many small database calls: every section shares the
 * same filters, so the page makes one authorised request; the server then
 * runs one function per section in parallel (Workers queue more than six
 * outbound connections for us) and a failing section only marks itself as
 * failed. Aggregation happens in Postgres; the transforms here are O(rows).
 * The daily purge rides along (its guard makes it a no-op after the first
 * call of the day).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OverviewResponse, OverviewSections, SectionResult } from "../api";
import { isRangeError, resolveRange, type RangeKey, type ResolvedRange, RANGE_KEYS } from "../range";
import { ANALYTICS_RPC, callAnalyticsRpc, type RangeArgs, type RpcError, type RpcKey } from "../rpc";
import { ANALYTICS_MIGRATION, isAnalyticsMissingError, logAnalyticsErrorOnce, type SetupRequired } from "../setup";
import type { DeviceClass } from "../types";
import { computeProductFlags, kpisFromSummary } from "./metrics";

export interface Filters {
  range: ResolvedRange;
  device: DeviceClass | null;
}

const DEVICES: readonly DeviceClass[] = ["mobile", "tablet", "desktop"];

export function parseFilters(
  url: URL,
  now = new Date(),
): Filters | { error: "invalid_range" | "end_before_start" | "too_long" } {
  const rangeParam = (url.searchParams.get("range") ?? "30d") as RangeKey;
  if (!RANGE_KEYS.includes(rangeParam)) return { error: "invalid_range" };
  const compare = url.searchParams.get("compare") !== "0";
  const range = resolveRange(
    { range: rangeParam, from: url.searchParams.get("from"), to: url.searchParams.get("to"), compare },
    now,
  );
  if (isRangeError(range)) return range;
  const d = url.searchParams.get("device");
  const device = DEVICES.includes(d as DeviceClass) ? (d as DeviceClass) : null;
  return { range, device };
}

export function rangeArgs(f: Filters): RangeArgs {
  return { from: f.range.from, to: f.range.to, device: f.device };
}

type Settled<T> = { data: T | null; error: RpcError | null };

function section<T, R>(res: Settled<R>, transform: (raw: R) => T, name: string): SectionResult<T> {
  if (res.error) return { ok: false, error: { code: res.error.code, message: "query_failed" } };
  if (res.data === null || res.data === undefined) {
    return { ok: false, error: { code: "empty", message: "no_data" } };
  }
  try {
    return { ok: true, data: transform(res.data) };
  } catch (e) {
    logAnalyticsErrorOnce(`transform:${name}`, { code: "transform_failed", message: String(e) });
    return { ok: false, error: { code: "transform_failed", message: "transform_failed" } };
  }
}

export async function runOverview(supabase: SupabaseClient, f: Filters): Promise<OverviewResponse> {
  const args = rangeArgs(f);
  const compareArgs = {
    ...args,
    prev_from: f.range.prevFrom,
    prev_to: f.range.prevTo,
    granularity: f.range.granularity,
  };
  const opts = { timeoutMs: 8000 };

  const [summary, funnel, acquisition, products, promotions, devices, pages, search, when, geography, health, purge] =
    await Promise.all([
      callAnalyticsRpc(supabase, "summary", compareArgs, opts),
      callAnalyticsRpc(supabase, "funnel", compareArgs, opts),
      callAnalyticsRpc(supabase, "acquisition", args, opts),
      callAnalyticsRpc(supabase, "products", args, opts),
      callAnalyticsRpc(supabase, "promotions", args, opts),
      callAnalyticsRpc(supabase, "devices", args, opts),
      callAnalyticsRpc(supabase, "pages", args, opts),
      callAnalyticsRpc(supabase, "search", args, opts),
      callAnalyticsRpc(supabase, "when", args, opts),
      callAnalyticsRpc(supabase, "geography", args, opts),
      callAnalyticsRpc(supabase, "health", {}, opts),
      callAnalyticsRpc(supabase, "purge", {}, opts),
    ]);

  const named: [RpcKey, Settled<unknown>][] = [
    ["summary", summary],
    ["funnel", funnel],
    ["acquisition", acquisition],
    ["products", products],
    ["promotions", promotions],
    ["devices", devices],
    ["pages", pages],
    ["search", search],
    ["when", when],
    ["geography", geography],
    ["health", health],
    ["purge", purge],
  ];
  const missing = named
    .filter(([, r]) => isAnalyticsMissingError(r.error))
    .map(([key]) => ANALYTICS_RPC[key]);
  if (missing.length > 0) {
    const body: SetupRequired = { status: "setup_required", missing: missing.sort(), migration: ANALYTICS_MIGRATION };
    return body;
  }
  for (const [key, r] of named) {
    if (r.error) logAnalyticsErrorOnce(`overview:${key}`, r.error);
  }

  const kpis = summary.data ? safeKpis(summary.data, f.range) : null;
  const sections: OverviewSections = {
    summary: kpis
      ? { ok: true, data: kpis.summary }
      : section(summary, (raw) => kpisFromSummary(raw, f.range).summary, "summary"),
    traffic: kpis
      ? { ok: true, data: kpis.traffic }
      : section(summary, (raw) => kpisFromSummary(raw, f.range).traffic, "traffic"),
    funnel: section(funnel, (raw) => raw, "funnel"),
    acquisition: section(acquisition, (raw) => raw, "acquisition"),
    products: section(products, computeProductFlags, "products"),
    promotions: section(promotions, (raw) => raw, "promotions"),
    devices: section(devices, (raw) => raw, "devices"),
    pages: section(pages, (raw) => raw, "pages"),
    search: section(search, (raw) => raw, "search"),
    when: section(when, (raw) => raw, "when"),
    geography: section(geography, (raw) => raw, "geography"),
  };

  return {
    status: "ok",
    generatedAt: new Date().toISOString(),
    range: f.range,
    device: f.device,
    health: section(health, (raw) => raw, "health"),
    sections,
  };
}

function safeKpis(raw: Parameters<typeof kpisFromSummary>[0], range: ResolvedRange) {
  try {
    return kpisFromSummary(raw, range);
  } catch {
    return null;
  }
}
