import { describe, expect, it } from "vitest";
import { accumulateEngaged, engagedSoFar, nextSession, pickAttribution } from "./session";
import type { Touch } from "./types";

const T0 = Date.parse("2026-11-25T10:00:00Z");
const MIN = 60_000;
const DAY = 86_400_000;

function touch(at: number, over: Partial<Touch> = {}): Touch {
  return {
    id: `00000000-0000-4000-8000-${String(at).padStart(12, "0").slice(-12)}`,
    at: new Date(at).toISOString(),
    landingPath: "/",
    referrerHost: null,
    utmSource: "instagram",
    utmMedium: "social",
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    utmId: null,
    clickIdType: null,
    clickId: null,
    inApp: null,
    ...over,
  };
}

describe("nextSession", () => {
  const ids = ["s1", "s2"];
  const makeId = () => ids.shift() ?? "sx";

  it("starts a session when there is none", () => {
    const r = nextSession(null, T0, makeId);
    expect(r.isNew).toBe(true);
    expect(r.session.startedAt).toBe(new Date(T0).toISOString());
  });

  it("keeps the session within 30 minutes of activity and moves lastActivityAt", () => {
    const prev = { id: "a", startedAt: new Date(T0).toISOString(), lastActivityAt: new Date(T0).toISOString() };
    const r = nextSession(prev, T0 + 29 * MIN, makeId);
    expect(r.isNew).toBe(false);
    expect(r.session.id).toBe("a");
    expect(r.session.lastActivityAt).toBe(new Date(T0 + 29 * MIN).toISOString());
  });

  it("starts a new session after 30 idle minutes", () => {
    const prev = { id: "a", startedAt: new Date(T0).toISOString(), lastActivityAt: new Date(T0).toISOString() };
    expect(nextSession(prev, T0 + 31 * MIN, makeId).isNew).toBe(true);
  });
});

describe("engaged time", () => {
  it("counts visible time between marks, capped at 30s per gap", () => {
    let s = { engagedMs: 0, lastMark: T0 };
    s = accumulateEngaged(s, T0 + 10_000, true);
    expect(s.engagedMs).toBe(10_000);
    s = accumulateEngaged(s, T0 + 10_000 + 5 * MIN, true);
    expect(s.engagedMs).toBe(40_000);
  });

  it("pauses while hidden", () => {
    let s = { engagedMs: 0, lastMark: T0 };
    s = accumulateEngaged(s, T0 + 5_000, false);
    expect(s).toEqual({ engagedMs: 5_000, lastMark: null });
    s = accumulateEngaged(s, T0 + 10 * MIN, true);
    expect(s.engagedMs).toBe(5_000);
    expect(engagedSoFar(s, T0 + 10 * MIN + 2_000)).toBe(7_000);
  });
});

describe("pickAttribution", () => {
  it("picks the last touch within 90 days, the first touch and the count", () => {
    const old = touch(T0 - 100 * DAY, { utmSource: "google", utmMedium: "cpc" });
    const a = touch(T0 - 10 * DAY);
    const b = touch(T0 - DAY, { utmSource: "klaviyo", utmMedium: "email" });
    const r = pickAttribution({ touches: [b, old, a], firstTouch: old }, T0);
    expect(r.lastTouch?.utmSource).toBe("klaviyo");
    expect(r.firstTouch?.utmSource).toBe("google");
    expect(r.touchCount).toBe(2);
  });

  it("never credits transactional email or a campaign name on its own", () => {
    const tx = touch(T0 - DAY, { utmSource: "transactional", utmMedium: "email" });
    const nameOnly = touch(T0 - 2 * DAY, { utmSource: null, utmMedium: null, utmCampaign: "x" });
    const r = pickAttribution({ touches: [tx, nameOnly], firstTouch: null }, T0);
    expect(r).toEqual({ firstTouch: null, lastTouch: null, touchCount: 0 });
  });
});
