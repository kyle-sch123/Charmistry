/**
 * GET /api/admin/analytics/journeys: a page of visits, newest first, for the
 * Journeys list. Filters: the overview's range/device, plus outcome
 * (any|paid|bag|browsed), channel, campaign, step (a funnel step) and q (an
 * order number like #ABCD1234 or a customer's email; a search ignores the
 * date range and finds every visit of the matching customer).
 *
 * Auth: `x-admin-key`. HTTP 200 `{ status: "setup_required" }` before
 * migration 014.
 */

import { isAuthorized } from "@/lib/admin-auth";
import { FUNNEL_STEPS, type FunnelStepKey } from "@/lib/analytics/events";
import { callAnalyticsRpc, type JourneysArgs } from "@/lib/analytics/rpc";
import { parseFilters } from "@/lib/analytics/server/admin";
import { isAnalyticsMissingError, logAnalyticsErrorOnce, setupRequiredResponse } from "@/lib/analytics/setup";
import { createServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const PAGE_SIZE = 25;
const OUTCOMES = ["any", "paid", "bag", "browsed"] as const;

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const url = new URL(request.url);
  const filters = parseFilters(url);
  if ("error" in filters) {
    return Response.json({ error: filters.error }, { status: 400, headers: NO_STORE });
  }
  const p = url.searchParams;
  const outcome = OUTCOMES.includes(p.get("outcome") as (typeof OUTCOMES)[number])
    ? (p.get("outcome") as JourneysArgs["outcome"])
    : "any";
  const step = FUNNEL_STEPS.includes(p.get("step") as FunnelStepKey) ? (p.get("step") as FunnelStepKey) : null;
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(p.get("page")) || 1)));
  const text = (key: string, max: number) => {
    const v = p.get(key)?.trim();
    return v ? v.slice(0, max) : null;
  };

  let supabase;
  try {
    supabase = createServerSupabase();
  } catch {
    return Response.json({ error: "service_error" }, { status: 500, headers: NO_STORE });
  }

  const { data, error } = await callAnalyticsRpc(
    supabase,
    "journeys",
    {
      from: filters.range.from,
      to: filters.range.to,
      device: filters.device,
      outcome,
      channel: text("channel", 40),
      campaign: text("campaign", 100),
      step,
      q: text("q", 254),
      page,
      page_size: PAGE_SIZE,
    },
    { timeoutMs: 8000 },
  );
  if (isAnalyticsMissingError(error)) return setupRequiredResponse(["analytics_journeys"]);
  if (error || !data) {
    if (error) logAnalyticsErrorOnce("journeys", error);
    return Response.json({ error: "service_error" }, { status: 500, headers: NO_STORE });
  }
  return Response.json(
    { status: "ok", page, pageSize: PAGE_SIZE, range: filters.range, ...data },
    { status: 200, headers: NO_STORE },
  );
}
