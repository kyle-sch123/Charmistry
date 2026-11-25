import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveRange, type ResolvedRange } from "../range";
import {
  clearIntegrationCache,
  parseResendTime,
  probeGa4,
  probeIntegrations,
  probeKlaviyo,
  probeMeta,
  probeResend,
} from "./integrations";

const range = resolveRange({ range: "30d", compare: false }, new Date("2026-11-25T12:00:00Z")) as ResolvedRange;
const NOW = Date.parse("2026-11-25T12:00:00Z");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => clearIntegrationCache());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("config-only probes", () => {
  it("GA4 is connected only with a measurement id", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "");
    expect(probeGa4().state).toBe("not_configured");
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST");
    expect(probeGa4().state).toBe("connected");
  });
  it("Meta is limited without the Conversions API token", () => {
    vi.stubEnv("NEXT_PUBLIC_FB_PIXEL_ID", "123");
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
    expect(probeMeta()).toMatchObject({ state: "limited", reason: "no_capi" });
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "tok");
    expect(probeMeta().state).toBe("connected");
  });
});

describe("probeKlaviyo", () => {
  it("reports a key without metrics access as limited", async () => {
    vi.stubEnv("KLAVIYO_API_KEY", "pk_test");
    vi.stubGlobal("fetch", vi.fn(async () => json({ errors: [] }, 403)));
    expect(await probeKlaviyo(range)).toMatchObject({ state: "limited", reason: "forbidden" });
  });

  it("sums email-attributed revenue from Placed Order", async () => {
    vi.stubEnv("KLAVIYO_API_KEY", "pk_test");
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("metric-aggregates")
        ? json({
            data: {
              attributes: {
                data: [
                  { dimensions: ["msg_1"], measurements: { sum_value: [100, 250.5] } },
                  { dimensions: [""], measurements: { sum_value: [999] } },
                ],
              },
            },
          })
        : json({ data: [{ id: "m1", attributes: { name: "Placed Order" } }], links: { next: null } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await probeKlaviyo(range)).toMatchObject({ state: "connected", metrics: { emailRevenue: 350.5 } });
    const aggBody = JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    expect(aggBody.data.attributes.filter[0]).toBe(`greater-or-equal(datetime,${range.fromDate}T00:00:00)`);
  });

  it("is limited (timeout) when Klaviyo doesn't answer within 3 seconds", async () => {
    vi.useFakeTimers();
    vi.stubEnv("KLAVIYO_API_KEY", "pk_test");
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const p = probeKlaviyo(range);
    await vi.advanceTimersByTimeAsync(3100);
    expect(await p).toMatchObject({ state: "limited", reason: "timeout" });
  });

  it("is not configured without a key", async () => {
    vi.stubEnv("KLAVIYO_API_KEY", "");
    expect((await probeKlaviyo(range)).state).toBe("not_configured");
  });
});

describe("probeResend", () => {
  it("parses Resend's Postgres-style timestamps", () => {
    expect(parseResendTime("2026-11-25 10:00:00.123456+00")).toBe(Date.parse("2026-11-25T10:00:00.123Z"));
  });

  it("counts emails in the last 24 hours", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          has_more: false,
          data: [
            { id: "1", created_at: "2026-11-25 09:00:00.000000+00" },
            { id: "2", created_at: "2026-11-24 13:00:00.000000+00" },
            { id: "3", created_at: "2026-11-23 09:00:00.000000+00" },
          ],
        }),
      ),
    );
    expect(await probeResend(NOW)).toMatchObject({ state: "connected", metrics: { emailsSent24h: 2, emailsCapped: false } });
  });

  it("reports a send-only key as limited", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", vi.fn(async () => json({ name: "restricted_api_key" }, 401)));
    expect(await probeResend(NOW)).toMatchObject({ state: "limited", reason: "forbidden" });
  });
});

describe("probeIntegrations", () => {
  it("caches for five minutes unless fresh", async () => {
    vi.stubEnv("KLAVIYO_API_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "");
    const first = await probeIntegrations(range, false);
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-NEW");
    expect((await probeIntegrations(range, false))[0].state).toBe(first[0].state);
    expect((await probeIntegrations(range, true))[0].state).toBe("connected");
  });
});
