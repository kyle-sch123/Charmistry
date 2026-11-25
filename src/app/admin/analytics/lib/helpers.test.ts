import { describe, expect, it } from "vitest";
import { computeDelta } from "./delta";
import { ago, count, dateShort, dateTime, duration, money, moneyCompact, percent, points, rangeCaption } from "./format";
import { apiQuery, readBase, readJourneys, toQuery } from "./url-state";

// en-ZA groups with a no-break space; normalise for readable assertions.
const n = (s: string) => s.replace(/ /g, " ");

describe("format", () => {
  it("formats money, counts and percentages in en-ZA", () => {
    expect(n(money(41280))).toBe("R41 280");
    expect(n(count(1204))).toBe("1 204");
    expect(percent(0.021)).toBe("2,1%");
    expect(percent(0.61, 0)).toBe("61%");
    expect(points(0.004)).toBe("0,4 pts");
    expect(moneyCompact(4000)).toBe("R4k");
    expect(moneyCompact(1500)).toBe("R1,5k");
  });
  it("formats durations", () => {
    expect(duration(22_000)).toBe("22s");
    expect(duration(108_000)).toBe("1m 48s");
    expect(duration(3_900_000)).toBe("1h 5m");
  });
  it("formats dates in SAST", () => {
    expect(dateShort("2026-10-26T22:30:00Z")).toBe("27 Oct");
    expect(dateTime("2026-11-25T12:02:00Z")).toBe("25 Nov, 14:02");
    expect(rangeCaption("2026-10-27", "2026-11-25")).toBe("27 Oct – 25 Nov 2026");
    expect(ago("2026-11-25T12:00:00Z", Date.parse("2026-11-25T12:02:30Z"))).toBe("2 min ago");
  });
});

describe("computeDelta", () => {
  it("uses relative change for larger counts and money", () => {
    expect(computeDelta(118, 100, "count")).toMatchObject({ direction: "up", tone: "good", text: "▲ 18%" });
    expect(computeDelta(1086, 1121, "money")).toMatchObject({ direction: "down", tone: "bad", text: "▼ 3,1%" });
  });
  it("uses the absolute change when the previous value is under 20", () => {
    expect(computeDelta(38, 9, "count").text).toBe("▲ 29");
  });
  it("uses percentage points for rates and respects up-is-bad", () => {
    expect(computeDelta(0.032, 0.028, "rate").text).toBe("▲ 0,4 pts");
    expect(computeDelta(0.41, 0.43, "rate", false)).toMatchObject({ direction: "down", tone: "good" });
  });
  it("treats tiny changes as flat and missing previous as no comparison", () => {
    expect(computeDelta(1001, 1000, "count")).toMatchObject({ direction: "flat", text: "— 0%" });
    expect(computeDelta(5, null, "count")).toMatchObject({ direction: "none", text: "No comparison" });
  });
});

describe("url-state", () => {
  it("reads filters with safe defaults", () => {
    expect(readBase(new URLSearchParams("range=bogus&device=fridge"))).toEqual({
      range: "30d",
      from: null,
      to: null,
      device: null,
      compare: true,
    });
    expect(readJourneys(new URLSearchParams("outcome=paid&step=paid&page=3&q=%20x%20"))).toMatchObject({
      outcome: "paid",
      step: "paid",
      page: 3,
      q: "x",
    });
  });
  it("leaves defaults out of page URLs but spells them out for the API", () => {
    expect(toQuery({ range: "30d", device: null, compare: true })).toBe("");
    expect(toQuery({ range: "7d", device: "mobile", compare: false })).toBe("?range=7d&device=mobile&compare=0");
    expect(apiQuery({ range: "30d", compare: true })).toBe("?range=30d&device=all&compare=1");
  });
});
