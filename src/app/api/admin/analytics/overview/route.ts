/**
 * GET /api/admin/analytics/overview: every section of the analytics overview
 * for one set of filters (?range=today|7d|30d|90d|custom&from&to&device&compare).
 *
 * Auth: `x-admin-key` == ADMIN_FULFILMENT_KEY (same as the other admin tools).
 * Answers `{ status: "setup_required" }` with HTTP 200 when migration 014
 * hasn't been applied: that's an expected state with its own panel, not an
 * error. A failing section never fails the page (see server/admin.ts).
 */

import { isAuthorized } from "@/lib/admin-auth";
import { parseFilters, runOverview } from "@/lib/analytics/server/admin";
import { createServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const filters = parseFilters(new URL(request.url));
  if ("error" in filters) {
    return Response.json({ error: filters.error }, { status: 400, headers: NO_STORE });
  }
  let supabase;
  try {
    supabase = createServerSupabase();
  } catch {
    return Response.json({ error: "service_error" }, { status: 500, headers: NO_STORE });
  }
  const body = await runOverview(supabase, filters);
  return Response.json(body, { status: 200, headers: NO_STORE });
}
