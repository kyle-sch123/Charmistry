/**
 * GET /api/admin/analytics/integrations: whether GA4, Meta (Pixel and
 * Conversions API), Klaviyo and Resend are connected, for the Tracking
 * section. Kept separate from the overview so a slow third-party API never
 * delays the dashboard. `?fresh=1` bypasses the 5-minute per-isolate cache.
 *
 * Auth: `x-admin-key`.
 */

import { isAuthorized } from "@/lib/admin-auth";
import type { IntegrationsResponse } from "@/lib/analytics/api";
import { parseFilters } from "@/lib/analytics/server/admin";
import { probeIntegrations } from "@/lib/analytics/server/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const url = new URL(request.url);
  const filters = parseFilters(url);
  if ("error" in filters) {
    return Response.json({ error: filters.error }, { status: 400, headers: NO_STORE });
  }
  const integrations = await probeIntegrations(filters.range, url.searchParams.get("fresh") === "1");
  const body: IntegrationsResponse = {
    status: "ok",
    checkedAt: new Date().toISOString(),
    integrations,
  };
  return Response.json(body, { status: 200, headers: NO_STORE });
}
