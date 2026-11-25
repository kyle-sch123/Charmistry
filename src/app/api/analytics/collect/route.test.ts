import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  const state = {
    calls: [] as { name: string; args: { p: Record<string, unknown> } }[],
    result: { data: { skipped: false }, error: null } as {
      data: unknown;
      error: { code: string; message: string } | null;
    },
    throwOnCreate: false,
  };
  const client = {
    rpc(name: string, args: { p: Record<string, unknown> }) {
      state.calls.push({ name, args });
      const query = {
        abortSignal: () => query,
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve(state.result).then(resolve, reject),
      };
      return query;
    },
  };
  return { state, client };
});

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: () => {
    if (H.state.throwOnCreate) throw new Error("missing service role key");
    return H.client;
  },
}));
vi.mock("@/lib/analytics/server/geo", () => ({
  readGeo: () => ({ country: "ZA", city: null }),
}));

import { POST } from "./route";

const URL_ = "http://localhost:3000/api/analytics/collect";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 Safari/604.1";

function payload(over: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    v: 1,
    visitorId: "11111111-1111-4111-8111-111111111111",
    sessionOnly: false,
    session: {
      id: "a1111111-1111-4111-8111-111111111111",
      startedAt: now,
      landingPath: "/",
      deviceHint: null,
    },
    touches: [
      {
        id: "d1111111-1111-4111-8111-111111111111",
        at: now,
        landingPath: "/",
        referrerHost: null,
        utmSource: "insert",
        utmMedium: "qr",
        utmCampaign: "always-on_unboxing",
        utmContent: null,
        utmTerm: null,
        utmId: null,
        clickIdType: null,
        clickId: null,
        inApp: null,
      },
    ],
    pageViews: [
      {
        id: "e1111111-1111-4111-8111-111111111111",
        at: now,
        path: "/",
        pageType: "home",
        productSlug: null,
        title: "Charmistry",
        engagedMs: 4000,
        maxScrollPct: 50,
      },
    ],
    events: [],
    ...over,
  };
}

function post(body: unknown, headers: Record<string, string> = {}, url = URL_) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "text/plain;charset=UTF-8",
      origin: new URL(url).origin,
      "user-agent": UA,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  H.state.calls = [];
  H.state.result = { data: { skipped: false }, error: null };
  H.state.throwOnCreate = false;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/analytics/collect", () => {
  it("stores a valid batch with one ingest call and the enriched snake_case payload", async () => {
    const res = await POST(post(payload()));
    expect(res.status).toBe(204);
    expect(H.state.calls).toHaveLength(1);
    const { name, args } = H.state.calls[0];
    expect(name).toBe("analytics_ingest");
    expect(args.p).toMatchObject({
      session: { device: "mobile", os: "iOS", country: "ZA", landing_page_type: "home" },
      touches: [{ source: "insert", medium: "qr", channel: "QR codes", excluded: false }],
      page_views: [{ path: "/", engaged_ms: 4000, max_scroll_pct: 50 }],
    });
  });

  it("accepts a request with no Origin when Sec-Fetch-Site says same-origin", async () => {
    const req = new Request(URL_, {
      method: "POST",
      headers: { "user-agent": UA, "sec-fetch-site": "same-origin" },
      body: JSON.stringify(payload()),
    });
    await POST(req);
    expect(H.state.calls).toHaveLength(1);
  });

  it.each([
    ["a cross-origin request", post(payload(), { origin: "https://evil.example" })],
    ["a bot user agent", post(payload(), { "user-agent": "Googlebot/2.1" })],
    ["an oversized body", post(JSON.stringify({ ...payload(), pad: "x".repeat(40_000) }))],
    ["bad JSON", post("{not json")],
    ["an invalid payload", post(payload({ v: 9 }))],
  ])("drops %s with 204 and no RPC", async (_label, req) => {
    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(H.state.calls).toHaveLength(0);
  });

  it("honours the debug flag for bots only on localhost in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const botDebug = payload({ debug: true });
    await POST(post(botDebug, { "user-agent": "HeadlessChrome" }, "https://charmistry.co.za/api/analytics/collect"));
    expect(H.state.calls).toHaveLength(0);
    await POST(post(botDebug, { "user-agent": "HeadlessChrome" }));
    expect(H.state.calls).toHaveLength(1);
  });

  it("still answers 204 when the migration isn't applied, and logs once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    H.state.result = { data: null, error: { code: "PGRST202", message: "not found" } };
    expect((await POST(post(payload()))).status).toBe(204);
    expect((await POST(post(payload()))).status).toBe(204);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("collect"))).toHaveLength(1);
  });

  it("answers 204 even when the server client can't be created", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    H.state.throwOnCreate = true;
    expect((await POST(post(payload()))).status).toBe(204);
  });
});
