/**
 * POST /api/analytics/collect: receives tracker batches (page views, shop
 * events, campaign touches) and stores them through `analytics_ingest`.
 *
 * Why it always answers 204: the tracker sends with `sendBeacon` and never
 * reads the response, and a public endpoint shouldn't tell anyone why a batch
 * was dropped. Batches are dropped silently when they are too large, come
 * from another site, come from a bot (unless the local E2E debug flag is set),
 * fail validation, or when migration 014 hasn't been applied yet.
 *
 * Everything the browser says is re-checked (validate.ts), and the traffic
 * source is classified here, never trusted from the client. No IP address is
 * read; country and city come from Cloudflare (geo.ts).
 */

import { callAnalyticsRpc } from "@/lib/analytics/rpc";
import { buildIngestArgs, isLocalRequest, isSameOrigin } from "@/lib/analytics/server/collect";
import { readGeo } from "@/lib/analytics/server/geo";
import { logAnalyticsErrorOnce } from "@/lib/analytics/setup";
import { LIMITS } from "@/lib/analytics/types";
import { isBotUserAgent } from "@/lib/analytics/ua";
import { validateCollectPayload } from "@/lib/analytics/validate";
import { createServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noContent = () => new Response(null, { status: 204 });

export async function POST(request: Request): Promise<Response> {
  try {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > LIMITS.maxBodyBytes) return noContent();
    if (!isSameOrigin(request)) return noContent();

    const body = await request.text();
    if (body.length > LIMITS.maxBodyBytes) return noContent();

    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      return noContent();
    }

    const result = validateCollectPayload(raw, new Date());
    if (!result.ok) return noContent();
    const payload = result.payload;

    const userAgent = request.headers.get("user-agent");
    const debugBypass =
      payload.debug === true && (isLocalRequest(request) || process.env.NODE_ENV !== "production");
    if (isBotUserAgent(userAgent) && !debugBypass) return noContent();

    const args = buildIngestArgs(payload, userAgent, readGeo(request));
    if (!args) return noContent();

    const supabase = createServerSupabase();
    const { error } = await callAnalyticsRpc(supabase, "ingest", args, { timeoutMs: 3000 });
    if (error) logAnalyticsErrorOnce("collect", error);
  } catch (e) {
    logAnalyticsErrorOnce("collect", {
      code: "exception",
      message: e instanceof Error ? e.message : "unknown",
    });
  }
  return noContent();
}
