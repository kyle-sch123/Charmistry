import { describe, expect, it } from "vitest";
import { sanitiseTouch, shouldRecordTouch, touchFingerprint, touchFromLanding } from "./touch";

const NOW = new Date("2026-11-25T10:00:00Z");
const ID = "3f9a1c2e-5b6d-4e7f-8a9b-0c1d2e3f4a5b";

function land(search: string, referrer = "", userAgent: string | null = null) {
  return touchFromLanding({
    search,
    pathname: "/collections/daily-affair",
    referrer,
    ownHost: "charmistry.co.za",
    userAgent,
    now: NOW,
    id: ID,
  });
}

describe("touchFromLanding", () => {
  it("reads only allow-listed tags and never _kx", () => {
    const t = land("?utm_source=Klaviyo&utm_medium=email&utm_campaign=flow_welcome&_kx=SECRET&email=a@b.co");
    expect(t).toMatchObject({
      id: ID,
      landingPath: "/collections/daily-affair",
      utmSource: "klaviyo",
      utmMedium: "email",
      utmCampaign: "flow_welcome",
      clickIdType: null,
    });
    expect(JSON.stringify(t)).not.toContain("SECRET");
    expect(JSON.stringify(t)).not.toContain("a@b.co");
  });

  it("keeps a click id's case", () => {
    const t = land("?fbclid=IwAR0AbC_dEf-123");
    expect(t?.clickIdType).toBe("fbclid");
    expect(t?.clickId).toBe("IwAR0AbC_dEf-123");
  });

  it("records an external referrer but ignores our own site and PayFast", () => {
    expect(land("", "https://www.google.co.za/")?.referrerHost).toBe("www.google.co.za");
    expect(land("", "https://charmistry.co.za/shop")).toBeNull();
    expect(land("", "https://www.payfast.co.za/eng/process")).toBeNull();
  });

  it("uses the in-app user agent only when nothing else is known", () => {
    expect(land("", "", "Mozilla/5.0 Instagram 300.0")?.inApp).toBe("instagram");
    expect(land("?utm_source=x", "", "Mozilla/5.0 Instagram 300.0")?.inApp).toBeNull();
  });

  it("returns null for a direct visit", () => {
    expect(land("")).toBeNull();
    expect(land("?colour=gold")).toBeNull();
  });
});

describe("shouldRecordTouch", () => {
  const t = land("?utm_source=instagram&utm_medium=social")!;
  const fp = touchFingerprint(t);

  it("skips reloads and back/forward navigations", () => {
    expect(shouldRecordTouch(t, null, NOW.getTime(), "reload")).toBe(false);
    expect(shouldRecordTouch(t, null, NOW.getTime(), "back_forward")).toBe(false);
    expect(shouldRecordTouch(t, null, NOW.getTime(), "navigate")).toBe(true);
  });

  it("dedupes the same campaign within 30 minutes", () => {
    const last = { fingerprint: fp, at: new Date(NOW.getTime() - 10 * 60_000).toISOString() };
    expect(shouldRecordTouch(t, last, NOW.getTime(), "navigate")).toBe(false);
    const old = { fingerprint: fp, at: new Date(NOW.getTime() - 31 * 60_000).toISOString() };
    expect(shouldRecordTouch(t, old, NOW.getTime(), "navigate")).toBe(true);
    const other = { fingerprint: "other", at: last.at };
    expect(shouldRecordTouch(t, other, NOW.getTime(), "navigate")).toBe(true);
  });

  it("never records a missing candidate", () => {
    expect(shouldRecordTouch(null, null, NOW.getTime(), "navigate")).toBe(false);
  });
});

describe("sanitiseTouch", () => {
  it("re-normalises a client touch and drops junk", () => {
    const t = sanitiseTouch({
      id: ID.toUpperCase(),
      at: "2026-11-25T10:00:00.000Z",
      landingPath: "/shop?email=a@b.co",
      referrerHost: "EVIL<script>",
      utmSource: " Instagram ",
      utmMedium: "Social",
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      utmId: null,
      clickIdType: "fbclid",
      clickId: "bad id with spaces",
      inApp: "myspace",
    });
    expect(t).toMatchObject({
      id: ID,
      landingPath: "/shop",
      referrerHost: null,
      utmSource: "instagram",
      utmMedium: "social",
      clickIdType: null,
      clickId: null,
      inApp: null,
    });
  });

  it("rejects bad ids, bad dates and touches with no signal", () => {
    expect(sanitiseTouch({ id: "nope", at: NOW.toISOString(), utmSource: "x" })).toBeNull();
    expect(sanitiseTouch({ id: ID, at: "yesterday", utmSource: "x" })).toBeNull();
    expect(sanitiseTouch({ id: ID, at: NOW.toISOString() })).toBeNull();
    expect(sanitiseTouch("string")).toBeNull();
  });
});
