import { describe, expect, it } from "vitest";
import { isRangeError, resolveRange, sastDayStart, type ResolvedRange } from "./range";

// 25 Nov 2026, 14:30 SAST.
const NOW = new Date("2026-11-25T12:30:00Z");

function ok(r: ReturnType<typeof resolveRange>): ResolvedRange {
  if (isRangeError(r)) throw new Error(r.error);
  return r;
}

describe("sastDayStart", () => {
  it("puts SAST midnight at 22:00 UTC the day before", () => {
    expect(new Date(sastDayStart(NOW.getTime())).toISOString()).toBe("2026-11-24T22:00:00.000Z");
    // 23:30 UTC is already the next SAST day.
    expect(new Date(sastDayStart(Date.parse("2026-11-25T23:30:00Z"))).toISOString()).toBe(
      "2026-11-25T22:00:00.000Z",
    );
  });
});

describe("resolveRange", () => {
  it("today runs from SAST midnight to now in hourly buckets", () => {
    const r = ok(resolveRange({ range: "today", compare: true }, NOW));
    expect(r.from).toBe("2026-11-24T22:00:00.000Z");
    expect(r.to).toBe(NOW.toISOString());
    expect(r.granularity).toBe("hour");
    expect(r.buckets).toBe(24);
    expect(r.prevFrom).toBe("2026-11-23T22:00:00.000Z");
    expect(r.prevTo).toBe("2026-11-24T12:30:00.000Z");
    expect([r.fromDate, r.toDate]).toEqual(["2026-11-25", "2026-11-25"]);
  });

  it("30 days covers 30 SAST days including today, compared with the 30 before", () => {
    const r = ok(resolveRange({ range: "30d", compare: true }, NOW));
    expect(r.from).toBe("2026-10-26T22:00:00.000Z");
    expect(r.fromDate).toBe("2026-10-27");
    expect(r.toDate).toBe("2026-11-25");
    expect(r.buckets).toBe(30);
    expect(r.granularity).toBe("day");
    expect(r.prevFrom).toBe("2026-09-26T22:00:00.000Z");
    expect(r.prevToDate).toBe("2026-10-26");
  });

  it("drops the previous period when compare is off", () => {
    const r = ok(resolveRange({ range: "7d", compare: false }, NOW));
    expect(r.prevFrom).toBeNull();
    expect(r.prevTo).toBeNull();
    expect(r.prevFromDate).toBeNull();
  });

  it("custom ranges run from the start date to the end of the end date, capped at now", () => {
    const r = ok(resolveRange({ range: "custom", from: "2026-11-01", to: "2026-11-30", compare: true }, NOW));
    expect(r.from).toBe("2026-10-31T22:00:00.000Z");
    expect(r.to).toBe(NOW.toISOString());
    expect(r.toDate).toBe("2026-11-25");
    expect(r.granularity).toBe("day");
    expect(r.buckets).toBe(25);
    expect(r.prevTo).toBe(r.from);
  });

  it("a one-day custom range is hourly", () => {
    const r = ok(resolveRange({ range: "custom", from: "2026-11-20", to: "2026-11-20", compare: false }, NOW));
    expect(r.granularity).toBe("hour");
    expect(r.to).toBe("2026-11-20T22:00:00.000Z");
  });

  it("rejects bad custom ranges", () => {
    expect(resolveRange({ range: "custom", from: "2026-11-10", to: "2026-11-01", compare: false }, NOW)).toEqual({
      error: "end_before_start",
    });
    expect(resolveRange({ range: "custom", from: "2025-01-01", to: "2026-11-01", compare: false }, NOW)).toEqual({
      error: "too_long",
    });
    expect(resolveRange({ range: "custom", from: "2026-02-30", to: "2026-03-01", compare: false }, NOW)).toEqual({
      error: "invalid_range",
    });
    expect(resolveRange({ range: "custom", from: "2027-01-01", to: "2027-01-02", compare: false }, NOW)).toEqual({
      error: "invalid_range",
    });
  });

  it("accepts exactly 366 days", () => {
    const r = resolveRange({ range: "custom", from: "2025-11-25", to: "2026-11-25", compare: false }, NOW);
    expect(isRangeError(r)).toBe(false);
  });
});
