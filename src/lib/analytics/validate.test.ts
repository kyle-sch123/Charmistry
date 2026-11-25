import { describe, expect, it } from "vitest";
import { validateCollectPayload } from "./validate";

const NOW = new Date("2026-11-25T10:00:00Z");
const V = "11111111-1111-4111-8111-111111111111";
const S = "a1111111-1111-4111-8111-111111111111";
const PV = "e1111111-1111-4111-8111-111111111111";
const P = "b1111111-1111-4111-8111-111111111111";

function base(over: Record<string, unknown> = {}) {
  return {
    v: 1,
    visitorId: V,
    sessionOnly: false,
    session: { id: S, startedAt: "2026-11-25T09:59:00Z", landingPath: "/?email=a@b.co", deviceHint: null },
    touches: [],
    pageViews: [
      {
        id: PV,
        at: "2026-11-25T09:59:00Z",
        path: "/products/belle-ring-gold?ref=x",
        pageType: "home",
        productSlug: "evil",
        title: "Belle Ring",
        engagedMs: 99_999_999,
        maxScrollPct: 140,
      },
    ],
    events: [],
    ...over,
  };
}

describe("validateCollectPayload", () => {
  it("re-derives page type and strips query strings", () => {
    const r = validateCollectPayload(base(), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.session.landingPath).toBe("/");
    expect(r.payload.pageViews[0]).toMatchObject({
      path: "/products/belle-ring-gold",
      pageType: "product",
      productSlug: "belle-ring-gold",
      engagedMs: 21_600_000,
      maxScrollPct: 100,
    });
  });

  it("rejects the wrong version and bad ids", () => {
    expect(validateCollectPayload(base({ v: 2 }), NOW).ok).toBe(false);
    expect(validateCollectPayload(base({ visitorId: "x" }), NOW).ok).toBe(false);
    expect(validateCollectPayload(base({ session: { id: "nope" } }), NOW).ok).toBe(false);
    expect(validateCollectPayload("junk", NOW).ok).toBe(false);
  });

  it("rejects oversized batches", () => {
    expect(validateCollectPayload(base({ events: new Array(51).fill({}) }), NOW).ok).toBe(false);
  });

  it("drops unknown events and keys, clamps numbers and redacts emails in searches", () => {
    const r = validateCollectPayload(
      base({
        events: [
          { id: "f1111111-1111-4111-8111-111111111111", name: "drop_table", at: NOW.toISOString(), props: {} },
          {
            id: "f1111111-1111-4111-8111-111111111112",
            name: "add_to_cart",
            at: NOW.toISOString(),
            pageViewId: PV,
            props: { product_id: P, name: "Belle Ring", price: 560, quantity: 500, source: "pdp_sticky", secret: "x" },
          },
          {
            id: "f1111111-1111-4111-8111-111111111113",
            name: "search",
            at: NOW.toISOString(),
            pageViewId: "f9999999-9999-4999-8999-999999999999",
            props: { term: "me@example.com", results: 3 },
          },
          {
            id: "f1111111-1111-4111-8111-111111111114",
            name: "add_to_cart",
            at: NOW.toISOString(),
            props: { product_id: P, name: "Belle Ring", price: 1, quantity: 1, source: "hacker" },
          },
        ],
      }),
      NOW,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.events).toHaveLength(2);
    const [add, search] = r.payload.events;
    expect(add.props).toMatchObject({ quantity: 99, source: "pdp_sticky", list: null, group_id: null });
    expect(add.props).not.toHaveProperty("secret");
    expect(add.pageViewId).toBe(PV);
    expect(search.props).toEqual({ term: "[email]", results: 3 });
    expect(search.pageViewId).toBeNull();
  });

  it("replaces timestamps outside the accepted window with now", () => {
    const r = validateCollectPayload(
      base({ session: { id: S, startedAt: "2020-01-01T00:00:00Z", landingPath: "/" } }),
      NOW,
    );
    expect(r.ok && r.payload.session.startedAt).toBe(NOW.toISOString());
  });
});
