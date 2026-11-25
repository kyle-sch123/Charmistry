import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "test-admin-key";

const H = vi.hoisted(() => {
  const state = {
    failing: new Set<string>(),
    missing: false,
    calls: [] as string[],
  };
  const DATA: Record<string, unknown> = {
    analytics_summary: {
      current: {
        totals: { sessions: 10, visitors: 8, adds: 2, engaged_ms: 50_000, bounces: 3, conversions: 1, orders: 1, revenue: 600 },
        buckets: [],
      },
      previous: null,
    },
    analytics_funnel: { current: [10, 6, 2, 1, 1, 1, 1], previous: null },
    analytics_products: { rows: [] },
    analytics_health: { ever: true, events_24h: 5, page_views_24h: 9, last_at: null },
    analytics_purge: { ran: false, sessions: 0, touches: 0, visitors: 0 },
  };
  const client = {
    rpc(name: string) {
      state.calls.push(name);
      const result = state.missing
        ? { data: null, error: { code: "PGRST202", message: "Could not find the function" } }
        : state.failing.has(name)
          ? { data: null, error: { code: "57014", message: "statement timeout" } }
          : { data: DATA[name] ?? { rows: [] }, error: null };
      const q = {
        abortSignal: () => q,
        then: (a: (v: unknown) => unknown, b: (e: unknown) => unknown) => Promise.resolve(result).then(a, b),
      };
      return q;
    },
  };
  return { state, client };
});

vi.mock("@/lib/supabase-server", () => ({ createServerSupabase: () => H.client }));

import { GET } from "./route";

function get(query = "", key: string | null = KEY) {
  return new Request(`http://localhost:3000/api/admin/analytics/overview${query}`, {
    headers: key ? { "x-admin-key": key } : {},
  });
}

beforeEach(() => {
  vi.stubEnv("ADMIN_FULFILMENT_KEY", KEY);
  H.state.failing = new Set();
  H.state.missing = false;
  H.state.calls = [];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/admin/analytics/overview", () => {
  it("rejects a missing or wrong admin key", async () => {
    expect((await GET(get("", null))).status).toBe(401);
    expect((await GET(get("", "wrong"))).status).toBe(401);
  });

  it("rejects a bad range", async () => {
    const res = await GET(get("?range=custom&from=2026-11-10&to=2026-11-01"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "end_before_start" });
    expect((await GET(get("?range=forever"))).status).toBe(400);
  });

  it("answers setup_required (200) listing the missing functions before migration 014", async () => {
    H.state.missing = true;
    const res = await GET(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("setup_required");
    expect(body.missing).toContain("analytics_summary");
    expect(body.migration).toBe("014_analytics.sql");
  });

  it("keeps the other sections when one fails", async () => {
    H.state.failing.add("analytics_pages");
    const res = await GET(get("?range=7d&device=mobile"));
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.device).toBe("mobile");
    expect(body.sections.pages).toEqual({ ok: false, error: { code: "57014", message: "query_failed" } });
    expect(body.sections.summary.ok).toBe(true);
    expect(body.sections.summary.data.revenue.value).toBe(600);
    expect(body.sections.traffic.data.labels).toHaveLength(7);
    expect(body.sections.funnel).toEqual({ ok: true, data: { current: [10, 6, 2, 1, 1, 1, 1], previous: null } });
    expect(H.state.calls).toContain("analytics_purge");
  });
});
