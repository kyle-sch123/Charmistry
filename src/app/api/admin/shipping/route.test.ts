/**
 * Route-level tests for /api/admin/shipping.
 *
 * A tiny in-memory fake stands in for the service-role client: one
 * `shipping_rates` table supporting select + upsert(onConflict: method_id),
 * plus a switch to simulate the table not existing (migration 013 not applied).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  type Row = { method_id: string; price: number; updated_at?: string };
  const state: { rows: Row[]; tableExists: boolean } = {
    rows: [],
    tableExists: true,
  };
  const missing = {
    code: "PGRST205",
    message: "Could not find the table 'public.shipping_rates' in the schema cache",
  };

  const client = {
    from(table: string) {
      if (table !== "shipping_rates") throw new Error(`unexpected table ${table}`);
      return {
        select: async () =>
          state.tableExists
            ? { data: state.rows.map((r) => ({ ...r })), error: null }
            : { data: null, error: missing },
        upsert: async (rows: Row[], opts: { onConflict?: string }) => {
          if (!state.tableExists) return { error: missing };
          if (opts.onConflict !== "method_id") throw new Error("expected onConflict");
          for (const row of rows) {
            const i = state.rows.findIndex((r) => r.method_id === row.method_id);
            if (i === -1) state.rows.push({ ...row });
            else state.rows[i] = { ...row };
          }
          return { error: null };
        },
      };
    },
  };
  return { state, client };
});

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: () => H.client,
}));

import { GET, PATCH } from "./route";

const KEY = "test-admin-key";

function req(method: "GET" | "PATCH", body?: unknown, key: string | null = KEY) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (key) headers.set("x-admin-key", key);
  return new Request("http://localhost/api/admin/shipping", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

type MethodView = { id: string; price: number; defaultPrice: number };

function prices(json: { methods: MethodView[] }) {
  return Object.fromEntries(json.methods.map((m) => [m.id, m.price]));
}

beforeEach(() => {
  vi.stubEnv("ADMIN_FULFILMENT_KEY", KEY);
  H.state.tableExists = true;
  H.state.rows = [
    { method_id: "pudo_locker", price: 59 },
    { method_id: "courier_economy", price: 79 },
  ];
});

describe("auth", () => {
  it("rejects a missing or wrong key on both verbs", async () => {
    expect((await GET(req("GET", undefined, null))).status).toBe(401);
    expect((await GET(req("GET", undefined, "wrong"))).status).toBe(401);
    const patch = await PATCH(req("PATCH", { prices: { pudo_locker: 1 } }, "wrong"));
    expect(patch.status).toBe(401);
    expect(H.state.rows.find((r) => r.method_id === "pudo_locker")?.price).toBe(59);
  });
});

describe("GET", () => {
  it("lists every method with its live price and default", async () => {
    H.state.rows = [{ method_id: "courier_economy", price: 95 }];
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.configured).toBe(true);
    // A method with no row reads as its default.
    expect(prices(json)).toEqual({ pudo_locker: 59, courier_economy: 95 });
    expect(
      json.methods.find((m: MethodView) => m.id === "courier_economy").defaultPrice,
    ).toBe(79);
  });

  it("reports configured:false with the defaults when the table is missing", async () => {
    H.state.tableExists = false;
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.configured).toBe(false);
    expect(prices(json)).toEqual({ pudo_locker: 59, courier_economy: 79 });
  });
});

describe("PATCH", () => {
  it("saves a changed price and returns what is now stored", async () => {
    const res = await PATCH(req("PATCH", { prices: { courier_economy: "85.5" } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(prices(json)).toEqual({ pudo_locker: 59, courier_economy: 85.5 });
    expect(H.state.rows.find((r) => r.method_id === "courier_economy")).toMatchObject({
      price: 85.5,
      updated_at: expect.any(String),
    });
  });

  it("rejects an unknown method without writing anything", async () => {
    const res = await PATCH(
      req("PATCH", { prices: { pudo_locker: 60, free_yacht: 1 } }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unknown_method", method: "free_yacht" });
    expect(H.state.rows.find((r) => r.method_id === "pudo_locker")?.price).toBe(59);
  });

  it.each([0, -5, 1001, "abc", null, true])(
    "rejects the price %s",
    async (bad) => {
      const res = await PATCH(req("PATCH", { prices: { pudo_locker: bad } }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("invalid_price");
      expect(H.state.rows.find((r) => r.method_id === "pudo_locker")?.price).toBe(59);
    },
  );

  it("rejects a body with no prices", async () => {
    expect((await PATCH(req("PATCH", {}))).status).toBe(400);
    expect((await PATCH(req("PATCH", { prices: [] }))).status).toBe(400);
    expect((await PATCH(req("PATCH", { prices: {} }))).status).toBe(400);
  });

  it("rejects malformed JSON", async () => {
    const bad = new Request("http://localhost/api/admin/shipping", {
      method: "PATCH",
      headers: { "x-admin-key": KEY, "Content-Type": "application/json" },
      body: "{not json",
    });
    expect((await PATCH(bad)).status).toBe(400);
  });

  it("answers setup_required when the table doesn't exist yet", async () => {
    H.state.tableExists = false;
    const res = await PATCH(req("PATCH", { prices: { pudo_locker: 65 } }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "setup_required" });
  });
});
