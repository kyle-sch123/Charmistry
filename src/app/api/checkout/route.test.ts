import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A fake Supabase covering exactly the calls /api/checkout makes on the PayFast
// path, plus the analytics RPC. The point of these tests: the attribution
// snapshot can never change what checkout answers.
const H = vi.hoisted(() => {
  const ORDER = "c1111111-1111-4111-8111-111111111111";
  const PRODUCT = {
    id: "b1111111-1111-4111-8111-111111111111",
    name: "Belle Ring",
    slug: "belle-ring-gold",
    price: 560,
    image_url: null,
    in_stock: true,
    quantity: 5,
    categories: { slug: "rings" },
  };
  const state = {
    log: [] as string[],
    rpcCalls: [] as { name: string; p: Record<string, unknown> }[],
    rpcMode: "ok" as "ok" | "error" | "throw" | "hang",
  };
  const client = {
    from(table: string) {
      if (table === "products") {
        return { select: () => ({ in: async () => ({ data: [PRODUCT], error: null }) }) };
      }
      if (table === "orders") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => {
                state.log.push("orders.insert");
                return { data: { id: ORDER }, error: null };
              },
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
          delete: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === "order_items") {
        return {
          insert: async () => {
            state.log.push("order_items.insert");
            return { error: null };
          },
          delete: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc(name: string, args: { p: Record<string, unknown> }) {
      state.log.push(`rpc:${name}`);
      state.rpcCalls.push({ name, p: args.p });
      if (state.rpcMode === "throw") throw new Error("boom");
      const result =
        state.rpcMode === "error"
          ? { data: null, error: { code: "PGRST202", message: "missing" } }
          : { data: null, error: null };
      const promise = state.rpcMode === "hang" ? new Promise(() => undefined) : Promise.resolve(result);
      const q = {
        abortSignal: () => q,
        then: (a: (v: unknown) => unknown, b: (e: unknown) => unknown) => promise.then(a, b),
      };
      return q;
    },
  };
  return { ORDER, state, client };
});

vi.mock("@/lib/supabase-server", () => ({ createServerSupabase: () => H.client }));
vi.mock("@/lib/auth/server", () => ({ getVerifiedUser: async () => null }));
vi.mock("@/lib/payfast", () => ({
  buildPaymentRequest: () => ({
    paymentUrl: "https://sandbox.payfast.co.za/eng/process",
    formData: { m_payment_id: H.ORDER },
  }),
}));
vi.mock("@/lib/shipping-rates", async () => {
  const shipping = await import("@/lib/shipping");
  return { loadShippingRates: async () => shipping.ratesFromRows(null) };
});
vi.mock("@/lib/analytics/server/geo", () => ({ readGeo: () => ({ country: "ZA", city: null }) }));

import { POST } from "./route";

const ATTRIBUTION = {
  visitorId: "11111111-1111-4111-8111-111111111111",
  sessionId: "a1111111-1111-4111-8111-111111111111",
  firstTouch: {
    id: "d1111111-1111-4111-8111-111111111111",
    at: "2026-11-20T10:00:00.000Z",
    landingPath: "/",
    referrerHost: null,
    utmSource: "instagram",
    utmMedium: "social",
    utmCampaign: "2026-11_launch",
    utmContent: null,
    utmTerm: null,
    utmId: null,
    clickIdType: null,
    clickId: null,
    inApp: null,
  },
  lastTouch: null,
  touchCount: 1,
  fbclid: null,
  fbp: null,
  fbc: null,
};

function checkout(attribution?: unknown) {
  return new Request("http://localhost:3000/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "UA/1.0" },
    body: JSON.stringify({
      customer: {
        email: "thandi@example.com",
        firstName: "Thandi",
        lastName: "Mokoena",
        addressLine1: "1 Long St",
        city: "Cape Town",
        postalCode: "8001",
        country: "ZA",
      },
      lines: [{ id: "b1111111-1111-4111-8111-111111111111", quantity: 1 }],
      shippingMethod: "pudo_locker",
      ...(attribution === undefined ? {} : { attribution }),
    }),
  });
}

async function run(attribution?: unknown) {
  const res = await POST(checkout(attribution));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  H.state.log = [];
  H.state.rpcCalls = [];
  H.state.rpcMode = "ok";
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/checkout with first-party attribution", () => {
  it("answers the same with or without attribution, and records it once after the order", async () => {
    const without = await run();
    expect(without.status).toBe(200);
    expect(without.body).toMatchObject({ success: true, orderId: H.ORDER });
    expect(H.state.rpcCalls).toHaveLength(0);

    H.state.log = [];
    const withIt = await run(ATTRIBUTION);
    expect(withIt).toEqual(without);
    expect(H.state.rpcCalls).toHaveLength(1);
    expect(H.state.rpcCalls[0]).toMatchObject({
      name: "analytics_attribute_order",
      p: { order_id: H.ORDER, first_touch: { channel: "Organic social" } },
    });
    expect(H.state.log.indexOf("rpc:analytics_attribute_order")).toBeGreaterThan(
      H.state.log.indexOf("order_items.insert"),
    );
  });

  it.each(["error", "throw"] as const)("answers the same when the analytics RPC %ss", async (mode) => {
    const baseline = await run();
    H.state.rpcMode = mode;
    expect(await run(ATTRIBUTION)).toEqual(baseline);
  });

  it("answers the same for a junk attribution claim, without calling the RPC", async () => {
    const baseline = await run();
    expect(await run({ visitorId: "nope", hack: true })).toEqual(baseline);
    expect(H.state.rpcCalls).toHaveLength(0);
  });

  it("doesn't hang checkout when the analytics RPC never answers", async () => {
    const baseline = await run();
    H.state.rpcMode = "hang";
    const started = Date.now();
    expect(await run(ATTRIBUTION)).toEqual(baseline);
    expect(Date.now() - started).toBeLessThan(2500);
  });
});
