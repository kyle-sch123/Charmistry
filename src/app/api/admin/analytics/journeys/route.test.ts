import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "test-admin-key";

const H = vi.hoisted(() => {
  const state = {
    calls: [] as { name: string; p: Record<string, unknown> }[],
    result: { data: null as unknown, error: null as null | { code: string; message: string } },
  };
  const client = {
    rpc(name: string, args: { p: Record<string, unknown> }) {
      state.calls.push({ name, p: args.p });
      const q = {
        abortSignal: () => q,
        then: (a: (v: unknown) => unknown, b: (e: unknown) => unknown) => Promise.resolve(state.result).then(a, b),
      };
      return q;
    },
  };
  return { state, client };
});

vi.mock("@/lib/supabase-server", () => ({ createServerSupabase: () => H.client }));

import { GET as LIST } from "./route";
import { GET as DETAIL } from "./[sessionId]/route";

const SESSION = "a1111111-1111-4111-8111-111111111111";

function req(path: string, key: string | null = KEY) {
  return new Request(`http://localhost:3000${path}`, { headers: key ? { "x-admin-key": key } : {} });
}
const params = (sessionId: string) => ({ params: Promise.resolve({ sessionId }) });

beforeEach(() => {
  vi.stubEnv("ADMIN_FULFILMENT_KEY", KEY);
  H.state.calls = [];
  H.state.result = { data: { total: 0, rows: [], facets: { channels: [], campaigns: [] } }, error: null };
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/admin/analytics/journeys", () => {
  it("requires the admin key", async () => {
    expect((await LIST(req("/api/admin/analytics/journeys", null))).status).toBe(401);
  });

  it("passes clean filters through and pages by 25", async () => {
    const res = await LIST(
      req("/api/admin/analytics/journeys?range=30d&outcome=paid&step=reached_checkout&q=%20%23C1111111%20&page=2&channel=Email"),
    );
    expect(res.status).toBe(200);
    expect(H.state.calls[0].name).toBe("analytics_journeys");
    expect(H.state.calls[0].p).toMatchObject({
      outcome: "paid",
      step: "reached_checkout",
      q: "#C1111111",
      page: 2,
      page_size: 25,
      channel: "Email",
    });
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", page: 2, pageSize: 25, total: 0 });
  });

  it("ignores unknown outcomes and steps", async () => {
    await LIST(req("/api/admin/analytics/journeys?outcome=everything&step=nope"));
    expect(H.state.calls[0].p).toMatchObject({ outcome: "any", step: null });
  });

  it("answers setup_required before migration 014", async () => {
    H.state.result = { data: null, error: { code: "PGRST202", message: "missing" } };
    const body = await (await LIST(req("/api/admin/analytics/journeys"))).json();
    expect(body).toMatchObject({ status: "setup_required", missing: ["analytics_journeys"] });
  });
});

describe("GET /api/admin/analytics/journeys/[sessionId]", () => {
  it("is 404 for a malformed id without touching the database", async () => {
    const res = await DETAIL(req("/api/admin/analytics/journeys/nope"), params("nope"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "not_found" });
    expect(H.state.calls).toHaveLength(0);
  });

  it("is 404 for an unknown session", async () => {
    H.state.result = { data: null, error: null };
    const res = await DETAIL(req(`/api/admin/analytics/journeys/${SESSION}`), params(SESSION));
    expect(res.status).toBe(404);
  });

  it("returns the journey", async () => {
    H.state.result = { data: { session: { id: SESSION } }, error: null };
    const res = await DETAIL(req(`/api/admin/analytics/journeys/${SESSION}`), params(SESSION));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", journey: { session: { id: SESSION } } });
  });

  it("requires the admin key", async () => {
    expect((await DETAIL(req(`/api/admin/analytics/journeys/${SESSION}`, null), params(SESSION))).status).toBe(401);
  });
});
