import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  const state = {
    calls: [] as { name: string; p: Record<string, unknown> }[],
    mode: "ok" as "ok" | "error" | "hang",
    data: null as unknown,
    throwOnCreate: false,
  };
  const client = {
    rpc(name: string, args: { p: Record<string, unknown> }) {
      state.calls.push({ name, p: args.p });
      const result =
        state.mode === "error"
          ? { data: null, error: { code: "PGRST202", message: "missing" } }
          : { data: state.data, error: null };
      const promise = state.mode === "hang" ? new Promise(() => undefined) : Promise.resolve(result);
      const q = {
        abortSignal: () => q,
        then: (a: (v: unknown) => unknown, b: (e: unknown) => unknown) => promise.then(a, b),
      };
      return q;
    },
  };
  return { state, client };
});

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: () => {
    if (H.state.throwOnCreate) throw new Error("no key");
    return H.client;
  },
}));
vi.mock("./geo", () => ({ readGeo: () => ({ country: "ZA", city: null }) }));

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseCheckoutAttribution,
  readCapiContext,
  recordOrderAttribution,
  toClassifiedTouch,
} from "./attribution";

const ORDER = "c1111111-1111-4111-8111-111111111111";
const NOW = Date.parse("2026-11-25T10:00:00Z");

function touch(over: Record<string, unknown> = {}) {
  return {
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
    ...over,
  };
}

const VALID = {
  visitorId: "11111111-1111-4111-8111-111111111111",
  sessionId: "a1111111-1111-4111-8111-111111111111",
  firstTouch: touch(),
  lastTouch: touch({ utmSource: "transactional", utmMedium: "email" }),
  touchCount: 7,
  fbclid: { value: "IwAR0AbC", at: "2026-11-20T10:00:00Z" },
  fbp: "fb.1.1732000000000.123456789",
  fbc: "not-a-cookie",
};

const request = new Request("http://localhost:3000/api/checkout", { headers: { "user-agent": "UA/1.0" } });

beforeEach(() => {
  H.state.calls = [];
  H.state.mode = "ok";
  H.state.data = null;
  H.state.throwOnCreate = false;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("parseCheckoutAttribution", () => {
  it("keeps valid fields and drops a malformed _fbc", () => {
    const a = parseCheckoutAttribution(VALID);
    expect(a).toMatchObject({ touchCount: 7, fbp: VALID.fbp, fbc: null, fbclid: { value: "IwAR0AbC" } });
  });
  it("rejects missing ids and caps the touch count", () => {
    expect(parseCheckoutAttribution({ ...VALID, visitorId: "x" })).toBeNull();
    expect(parseCheckoutAttribution("junk")).toBeNull();
    expect(parseCheckoutAttribution({ ...VALID, touchCount: 5000 })?.touchCount).toBe(100);
  });
});

describe("toClassifiedTouch", () => {
  it("classifies on the server and never credits transactional email", () => {
    expect(toClassifiedTouch(parseCheckoutAttribution(VALID)!.firstTouch)).toMatchObject({
      channel: "Organic social",
      source: "instagram",
      campaign: "2026-11_launch",
    });
    expect(toClassifiedTouch(parseCheckoutAttribution(VALID)!.lastTouch)).toBeNull();
  });
});

describe("recordOrderAttribution", () => {
  it("stores one snapshot with server-classified touches", async () => {
    await recordOrderAttribution({ supabase: H.client as unknown as SupabaseClient, orderId: ORDER, raw: VALID, request });
    expect(H.state.calls).toHaveLength(1);
    expect(H.state.calls[0].name).toBe("analytics_attribute_order");
    expect(H.state.calls[0].p).toMatchObject({
      order_id: ORDER,
      last_touch: null,
      first_touch: { channel: "Organic social" },
      user_agent: "UA/1.0",
      country: "ZA",
    });
  });

  it("does nothing without a usable claim", async () => {
    await recordOrderAttribution({ supabase: H.client as unknown as SupabaseClient, orderId: ORDER, raw: undefined, request });
    expect(H.state.calls).toHaveLength(0);
  });

  it("never rejects when the database errors", async () => {
    H.state.mode = "error";
    await expect(
      recordOrderAttribution({ supabase: H.client as unknown as SupabaseClient, orderId: ORDER, raw: VALID, request }),
    ).resolves.toBeUndefined();
  });

  it("gives up after 1.5 seconds when the database hangs", async () => {
    vi.useFakeTimers();
    H.state.mode = "hang";
    const p = recordOrderAttribution({ supabase: H.client as unknown as SupabaseClient, orderId: ORDER, raw: VALID, request });
    await vi.advanceTimersByTimeAsync(1600);
    await expect(p).resolves.toBeUndefined();
  });
});

describe("readCapiContext", () => {
  it("builds _fbc from a recent ad click id when the cookie wasn't captured", async () => {
    H.state.data = { fbclid: "IwAR0AbC", fbclid_at: "2026-11-20T10:00:00.000Z", fbp: "fb.1.1.2", fbc: null, user_agent: "UA/1.0" };
    const ctx = await readCapiContext(ORDER, NOW);
    expect(ctx).toEqual({
      fbp: "fb.1.1.2",
      fbc: `fb.1.${Date.parse("2026-11-20T10:00:00.000Z")}.IwAR0AbC`,
      clientUserAgent: "UA/1.0",
    });
  });

  it("ignores a click id older than 90 days", async () => {
    H.state.data = { fbclid: "old", fbclid_at: "2026-01-01T00:00:00.000Z", fbp: null, fbc: null, user_agent: null };
    expect(await readCapiContext(ORDER, NOW)).toBeNull();
  });

  it("returns null when the migration is missing, the client can't be created, or the id is bad", async () => {
    H.state.mode = "error";
    expect(await readCapiContext(ORDER, NOW)).toBeNull();
    H.state.mode = "ok";
    H.state.throwOnCreate = true;
    expect(await readCapiContext(ORDER, NOW)).toBeNull();
    expect(await readCapiContext("nope", NOW)).toBeNull();
  });
});
