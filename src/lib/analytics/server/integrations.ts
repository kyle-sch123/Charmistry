/**
 * Health of the third-party connections, for the dashboard's Tracking section.
 *
 * Why live checks for Klaviyo and Resend: "the key is set" isn't the same as
 * "the key works". Klaviyo's key may be write-only (then email revenue can't
 * be shown) and Resend's may be send-only (then the 24-hour email count can't
 * be shown); both are reported as "Limited access" rather than errors.
 *
 * Every probe is capped at 3 seconds and runs in parallel. Results are cached
 * per isolate for 5 minutes (a Map, never a URL-keyed shared cache: this is
 * admin data). Probes only ever run from the admin integrations route.
 */

import type { IntegrationStatus } from "../api";
import type { ResolvedRange } from "../range";

const PROBE_CAP_MS = 3000;
const FETCH_TIMEOUT_MS = 2800;
const CACHE_TTL_MS = 5 * 60_000;
const KLAVIYO_REVISION = "2024-10-15";

const cache = new Map<string, { at: number; value: IntegrationStatus }>();

/** For tests. */
export function clearIntegrationCache(): void {
  cache.clear();
}

function status(
  key: IntegrationStatus["key"],
  state: IntegrationStatus["state"],
  reason: IntegrationStatus["reason"] = null,
  metrics: IntegrationStatus["metrics"] = {},
): IntegrationStatus {
  return { key, state, reason, metrics };
}

function isTimeout(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name ?? "";
  return name === "TimeoutError" || name === "AbortError";
}

async function capped(key: IntegrationStatus["key"], probe: () => Promise<IntegrationStatus>): Promise<IntegrationStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<IntegrationStatus>((resolve) => {
    timer = setTimeout(() => resolve(status(key, "limited", "timeout")), PROBE_CAP_MS);
  });
  try {
    return await Promise.race([
      probe().catch((e) => status(key, "limited", isTimeout(e) ? "timeout" : "error")),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function probeGa4(): IntegrationStatus {
  return process.env.NEXT_PUBLIC_GA_ID
    ? status("ga4", "connected")
    : status("ga4", "not_configured");
}

export function probeMeta(): IntegrationStatus {
  const pixel = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  if (!pixel) return status("meta", "not_configured");
  return process.env.META_CAPI_ACCESS_TOKEN
    ? status("meta", "connected")
    : status("meta", "limited", "no_capi");
}

function klaviyoHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Klaviyo-API-Key ${key}`,
    revision: KLAVIYO_REVISION,
    accept: "application/vnd.api+json",
    "content-type": "application/vnd.api+json",
  };
}

/** SAST wall-clock bounds for Klaviyo's datetime filter (it applies `timezone`). */
function klaviyoBounds(range: ResolvedRange): { from: string; to: string } {
  const next = new Date(Date.parse(`${range.toDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return { from: `${range.fromDate}T00:00:00`, to: `${next}T00:00:00` };
}

export async function probeKlaviyo(range: ResolvedRange): Promise<IntegrationStatus> {
  const key = process.env.KLAVIYO_API_KEY;
  if (!key) return status("klaviyo", "not_configured");
  return capped("klaviyo", async () => {
    const headers = klaviyoHeaders(key);
    let url: string | null = "https://a.klaviyo.com/api/metrics/";
    let metricId: string | null = null;
    for (let page = 0; page < 2 && url && !metricId; page++) {
      const res: Response = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.status === 401 || res.status === 403) return status("klaviyo", "limited", "forbidden");
      if (!res.ok) return status("klaviyo", "limited", "error");
      const body = (await res.json()) as {
        data?: { id?: string; attributes?: { name?: string } }[];
        links?: { next?: string | null };
      };
      metricId = body.data?.find((m) => m.attributes?.name === "Placed Order")?.id ?? null;
      url = body.links?.next ?? null;
    }
    if (!metricId) return status("klaviyo", "connected", null, { emailRevenue: 0 });
    const { from, to } = klaviyoBounds(range);
    const agg = await fetch("https://a.klaviyo.com/api/metric-aggregates/", {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        data: {
          type: "metric-aggregate",
          attributes: {
            metric_id: metricId,
            measurements: ["sum_value"],
            interval: "day",
            by: ["$attributed_message"],
            filter: [`greater-or-equal(datetime,${from})`, `less-than(datetime,${to})`],
            timezone: "Africa/Johannesburg",
          },
        },
      }),
    });
    if (agg.status === 401 || agg.status === 403) return status("klaviyo", "limited", "forbidden");
    if (!agg.ok) return status("klaviyo", "limited", "error");
    const result = (await agg.json()) as {
      data?: { attributes?: { data?: { dimensions?: string[]; measurements?: { sum_value?: number[] } }[] } };
    };
    let emailRevenue = 0;
    for (const row of result.data?.attributes?.data ?? []) {
      if (!row.dimensions?.[0]) continue;
      for (const v of row.measurements?.sum_value ?? []) emailRevenue += Number(v) || 0;
    }
    return status("klaviyo", "connected", null, { emailRevenue: Math.round(emailRevenue * 100) / 100 });
  });
}

/** Resend returns Postgres-style times ("2026-11-25 10:00:00.123456+00"). */
export function parseResendTime(s: string | undefined): number {
  if (!s) return NaN;
  const iso = s
    .trim()
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/([+-]\d\d)$/, "$1:00");
  return Date.parse(iso);
}

export async function probeResend(now = Date.now()): Promise<IntegrationStatus> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return status("resend", "not_configured");
  return capped("resend", async () => {
    const since = now - 86_400_000;
    let count = 0;
    let after: string | null = null;
    let capped = false;
    for (let page = 0; page < 2; page++) {
      const url = `https://api.resend.com/emails?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.status === 401 || res.status === 403) return status("resend", "limited", "forbidden");
      if (!res.ok) return status("resend", "limited", "error");
      const body = (await res.json()) as { data?: { id?: string; created_at?: string }[]; has_more?: boolean };
      const rows = body.data ?? [];
      let older = false;
      for (const e of rows) {
        const at = parseResendTime(e.created_at);
        if (Number.isFinite(at) && at >= since) count++;
        else older = true;
      }
      if (older || !body.has_more || rows.length === 0) break;
      after = rows[rows.length - 1]?.id ?? null;
      if (!after) break;
      if (page === 1) capped = true;
    }
    return status("resend", "connected", null, { emailsSent24h: count, emailsCapped: capped });
  });
}

/** All four, from cache unless `fresh`. */
export async function probeIntegrations(range: ResolvedRange, fresh: boolean): Promise<IntegrationStatus[]> {
  const now = Date.now();
  const cached = async (key: string, run: () => Promise<IntegrationStatus> | IntegrationStatus) => {
    const hit = cache.get(key);
    if (!fresh && hit && now - hit.at < CACHE_TTL_MS) return hit.value;
    const value = await run();
    cache.set(key, { at: now, value });
    return value;
  };
  return Promise.all([
    cached("ga4", probeGa4),
    cached("meta", probeMeta),
    cached(`klaviyo:${range.fromDate}:${range.toDate}`, () => probeKlaviyo(range)),
    cached("resend", () => probeResend(now)),
  ]);
}
