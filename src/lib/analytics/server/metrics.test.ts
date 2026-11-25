import { describe, expect, it } from "vitest";
import { resolveRange, type ResolvedRange } from "../range";
import type { ProductsRaw, SummaryRaw } from "../rpc";
import { bucketLabels, computeProductFlags, kpisFromSummary, median, percentile, safeRate } from "./metrics";

const range = resolveRange({ range: "7d", compare: true }, new Date("2026-11-25T12:30:00Z")) as ResolvedRange;

describe("helpers", () => {
  it("never divides by zero", () => {
    expect(safeRate(3, 0)).toBe(0);
    expect(safeRate(1, 4)).toBe(0.25);
  });
  it("computes medians and percentiles", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(percentile([10, 20, 30, 40, 50], 0.75)).toBe(40);
  });
  it("labels SAST days and hours", () => {
    expect(bucketLabels(range).labels).toEqual(["19 Nov", "20 Nov", "21 Nov", "22 Nov", "23 Nov", "24 Nov", "25 Nov"]);
    expect(bucketLabels(range).longLabels[0]).toBe("Thu 19 Nov");
    const today = resolveRange({ range: "today", compare: false }, new Date("2026-11-25T12:30:00Z")) as ResolvedRange;
    expect(bucketLabels(today).labels.slice(0, 3)).toEqual(["00", "01", "02"]);
  });
});

describe("kpisFromSummary", () => {
  const raw: SummaryRaw = {
    current: {
      totals: { sessions: 40, visitors: 30, adds: 10, engaged_ms: 400_000, bounces: 8, conversions: 2, orders: 3, revenue: 1500 },
      buckets: [{ i: 6, sessions: 40, visitors: 30, adds: 10, engaged_ms: 400_000, bounces: 8, conversions: 2, orders: 3, revenue: 1500 }],
    },
    previous: {
      totals: { sessions: 20, visitors: 15, adds: 2, engaged_ms: 100_000, bounces: 10, conversions: 1, orders: 1, revenue: 400 },
      buckets: [],
    },
  };

  it("builds KPI tiles with comparisons and zero-filled series", () => {
    const { summary, traffic } = kpisFromSummary(raw, range);
    expect(summary.revenue).toMatchObject({ value: 1500, previous: 400, sample: 40 });
    expect(summary.revenue.series).toEqual([0, 0, 0, 0, 0, 0, 1500]);
    expect(summary.conversionRate.value).toBeCloseTo(0.05);
    expect(summary.aov.value).toBe(500);
    expect(traffic.engagement.bounceRate.value).toBe(0.2);
    expect(traffic.engagement.avgEngagedMs.value).toBe(10_000);
    expect(traffic.previous).toHaveLength(7);
  });

  it("handles an empty window without dividing by zero", () => {
    const { summary } = kpisFromSummary({ current: { totals: {} as never, buckets: [] }, previous: null }, range);
    expect(summary.aov.value).toBe(0);
    expect(summary.revenue.previous).toBeNull();
  });
});

describe("computeProductFlags", () => {
  function row(key: string, views: number, viewPurchases: number, orders = 0) {
    return { key, name: key, slug: key, views, adds: 0, view_purchases: viewPurchases, orders, units: orders, revenue: 0 };
  }

  it("flags high-interest, low-conversion and under-exposed converters", () => {
    const raw: ProductsRaw = {
      rows: [
        row("popular-but-slow", 400, 2), // 0.5%: top views, low conversion
        row("steady-a", 100, 4), // 4%
        row("steady-b", 120, 5), // ~4.2%
        row("steady-c", 90, 3), // ~3.3%
        row("hidden-gem", 30, 3, 3), // 10%, few views, 3 orders
        row("too-few-views", 10, 5, 5),
      ],
    };
    const r = computeProductFlags(raw);
    expect(r.eligible).toBe(5);
    expect(r.flags.closerLook.map((f) => f.key)).toEqual(["popular-but-slow"]);
    expect(r.flags.promote.map((f) => f.key)).toEqual(["hidden-gem"]);
  });

  it("shows no flags with fewer than 3 eligible pieces or a zero median", () => {
    expect(computeProductFlags({ rows: [row("a", 50, 1), row("b", 60, 1)] }).flags).toEqual({ promote: [], closerLook: [] });
    expect(
      computeProductFlags({ rows: [row("a", 50, 0), row("b", 60, 0), row("c", 70, 0)] }).flags,
    ).toEqual({ promote: [], closerLook: [] });
  });
});
