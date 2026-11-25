import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./collect";

function req(url: string, headers: Record<string, string>) {
  return new Request(url, { method: "POST", headers });
}

describe("isSameOrigin", () => {
  it("accepts an Origin matching the Host header even when the URL host differs", () => {
    // `next dev --hostname 0.0.0.0` and some proxies give the route a different URL host.
    expect(isSameOrigin(req("http://0.0.0.0:3000/api/analytics/collect", { origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
  });
  it("accepts the forwarded host behind a proxy", () => {
    expect(
      isSameOrigin(
        req("http://worker.internal/api/analytics/collect", {
          origin: "https://charmistry.co.za",
          "x-forwarded-host": "charmistry.co.za",
        }),
      ),
    ).toBe(true);
  });
  it("rejects another site's Origin", () => {
    expect(isSameOrigin(req("https://charmistry.co.za/api/analytics/collect", { origin: "https://evil.example", host: "charmistry.co.za" }))).toBe(false);
  });
  it("falls back to Sec-Fetch-Site without an Origin", () => {
    expect(isSameOrigin(req("https://charmistry.co.za/api/analytics/collect", { "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(req("https://charmistry.co.za/api/analytics/collect", { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(req("https://charmistry.co.za/api/analytics/collect", {}))).toBe(false);
  });
});
