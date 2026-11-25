/**
 * GET /api/admin/analytics/journeys/[sessionId]: one visit in full (its
 * timeline of pages, actions and campaign arrivals), plus the visitor's other
 * visits. Visits on other devices are joined only through orders placed with
 * the same email; nothing else links them.
 *
 * Auth: `x-admin-key`. 404 `{ status: "not_found" }` for an unknown or
 * malformed id. HTTP 200 `{ status: "setup_required" }` before migration 014.
 */

import { isAuthorized } from "@/lib/admin-auth";
import { isUuid } from "@/lib/analytics/ids";
import { callAnalyticsRpc } from "@/lib/analytics/rpc";
import { isAnalyticsMissingError, logAnalyticsErrorOnce, setupRequiredResponse } from "@/lib/analytics/setup";
import { createServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const { sessionId } = await params;
  if (!isUuid(sessionId)) {
    return Response.json({ status: "not_found" }, { status: 404, headers: NO_STORE });
  }
  let supabase;
  try {
    supabase = createServerSupabase();
  } catch {
    return Response.json({ error: "service_error" }, { status: 500, headers: NO_STORE });
  }
  const { data, error } = await callAnalyticsRpc(
    supabase,
    "journey",
    { session_id: sessionId.toLowerCase() },
    { timeoutMs: 8000 },
  );
  if (isAnalyticsMissingError(error)) return setupRequiredResponse(["analytics_journey"]);
  if (error) {
    logAnalyticsErrorOnce("journey", error);
    return Response.json({ error: "service_error" }, { status: 500, headers: NO_STORE });
  }
  if (!data) {
    return Response.json({ status: "not_found" }, { status: 404, headers: NO_STORE });
  }
  return Response.json({ status: "ok", journey: data }, { status: 200, headers: NO_STORE });
}
