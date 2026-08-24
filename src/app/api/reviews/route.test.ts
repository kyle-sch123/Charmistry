/**
 * Route-level tests for POST /api/reviews.
 *
 * There is no purchase gate: any signed-in account may review any piece, and
 * the first block below pins that down from several angles, because it is a
 * deliberate policy choice that is easy to "helpfully" reintroduce.
 *
 * The second block covers the profile/guest-order claim the route still runs.
 * It no longer decides whether a review is accepted — it exists so the author
 * name has a profile row to snapshot — but it does still attach matching guest
 * orders, and these tests hold that behaviour steady.
 *
 * These are integration-style: a small in-memory fake Supabase stands in for
 * the service-role client and is SHARED between the route and the *real*
 * ensureProfileAndClaimOrders (both resolve createServerSupabase from the same
 * mocked module), so the claim genuinely flips orders.user_id rather than a spy
 * being called.
 *
 * The fake implements only the query shapes these two modules use (select /
 * insert / update / upsert with eq / is / in / ilike / limit / maybeSingle /
 * single, plus an order_items→orders!inner join).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// --- In-memory fake Supabase (shared via vi.hoisted so the mock factory and
// --- the test body reference the exact same db + auth state) ----------------
const H = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter = ["eq" | "is" | "in" | "ilike", string, unknown];

  const db: Record<string, Row[]> = {
    products: [],
    orders: [],
    order_items: [],
    profiles: [],
    reviews: [],
  };
  const ctx: { user: Row | null } = { user: null };
  let idSeq = 0;

  function matches(row: Row, [op, col, val]: Filter): boolean {
    const v = row[col];
    if (op === "eq") return v === val;
    if (op === "is") return val === null ? v === null || v === undefined : v === val;
    if (op === "in") return (val as unknown[]).includes(v);
    if (op === "ilike") {
      const pattern =
        "^" +
        String(val)
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/%/g, ".*") +
        "$";
      return typeof v === "string" && new RegExp(pattern, "i").test(v);
    }
    return false;
  }

  const stamp = "2026-07-21T00:00:00.000Z";

  class Query {
    private op: "select" | "insert" | "update" | "upsert" | "delete" =
      "select";
    private cols = "*";
    private filters: Filter[] = [];
    private isSingle = false;
    private isMaybe = false;
    private limitN: number | null = null;
    private values: Row | null = null;
    private rows: Row[] | null = null;
    private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {};

    constructor(private table: string) {}

    select(cols: string) {
      this.cols = cols;
      return this;
    }
    eq(col: string, val: unknown) {
      this.filters.push(["eq", col, val]);
      return this;
    }
    is(col: string, val: unknown) {
      this.filters.push(["is", col, val]);
      return this;
    }
    in(col: string, vals: unknown[]) {
      this.filters.push(["in", col, vals]);
      return this;
    }
    ilike(col: string, val: unknown) {
      this.filters.push(["ilike", col, val]);
      return this;
    }
    order() {
      return this;
    }
    returns() {
      return this;
    }
    limit(n: number) {
      this.limitN = n;
      return this;
    }
    update(values: Row) {
      this.op = "update";
      this.values = values;
      return this;
    }
    insert(rows: Row | Row[]) {
      this.op = "insert";
      this.rows = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    upsert(rows: Row | Row[], opts: Query["upsertOpts"]) {
      this.op = "upsert";
      this.rows = Array.isArray(rows) ? rows : [rows];
      this.upsertOpts = opts ?? {};
      return this;
    }
    maybeSingle() {
      this.isMaybe = true;
      return this.run();
    }
    single() {
      this.isSingle = true;
      return this.run();
    }
    // Thenable: `await query` (no explicit terminal) resolves here.
    then<T>(res: (v: { data: unknown; error: unknown }) => T, rej?: (e: unknown) => T) {
      return this.run().then(res, rej);
    }

    private base(): Row[] {
      return db[this.table] ?? (db[this.table] = []);
    }

    private async run(): Promise<{ data: unknown; error: unknown }> {
      try {
        return { data: this.exec(), error: null };
      } catch (e) {
        return { data: null, error: { message: String(e) } };
      }
    }

    private exec(): unknown {
      if (this.op === "insert") {
        const inserted = this.rows!.map((r) => {
          const row: Row = {
            id: `${this.table}-${++idSeq}`,
            created_at: stamp,
            updated_at: stamp,
            ...r,
          };
          this.base().push(row);
          return { ...row };
        });
        return this.isSingle ? inserted[0] : inserted;
      }

      if (this.op === "upsert") {
        const key = this.upsertOpts.onConflict ?? "id";
        for (const r of this.rows!) {
          const existing = this.base().find((x) => x[key] === r[key]);
          if (existing) {
            if (!this.upsertOpts.ignoreDuplicates) Object.assign(existing, r);
          } else {
            this.base().push({ created_at: stamp, updated_at: stamp, ...r });
          }
        }
        return null;
      }

      if (this.op === "delete") {
        const rows = this.base();
        const doomed = rows.filter((row) =>
          this.filters.every((f) => matches(row, f)),
        );
        db[this.table] = rows.filter((row) => !doomed.includes(row));
        const out = doomed.map((r) => ({ ...r }));
        if (this.isSingle) return out[0];
        if (this.isMaybe) return out[0] ?? null;
        return out;
      }

      if (this.op === "update") {
        const targets = this.base().filter((row) =>
          this.filters.every((f) => matches(row, f)),
        );
        for (const row of targets) Object.assign(row, this.values);
        const out = targets.map((r) => ({ ...r }));
        if (this.isSingle) return out[0];
        if (this.isMaybe) return out[0] ?? null;
        return out;
      }

      // select
      let rows: Row[];
      if (this.cols.includes("orders!inner")) {
        // order_items joined to their order, inner-join semantics.
        const baseFilters = this.filters.filter((f) => !f[1].startsWith("orders."));
        const joinFilters = this.filters
          .filter((f) => f[1].startsWith("orders."))
          .map((f) => [f[0], f[1].slice("orders.".length), f[2]] as Filter);
        rows = this.base()
          .filter((item) => {
            if (!baseFilters.every((f) => matches(item, f))) return false;
            const order = (db.orders ?? []).find((o) => o.id === item.order_id);
            return !!order && joinFilters.every((f) => matches(order, f));
          })
          .map((item) => ({ id: item.id }));
      } else {
        rows = this.base()
          .filter((row) => this.filters.every((f) => matches(row, f)))
          .map((r) => ({ ...r }));
      }
      if (this.limitN != null) rows = rows.slice(0, this.limitN);
      if (this.isSingle) return rows[0];
      if (this.isMaybe) return rows[0] ?? null;
      return rows;
    }
  }

  return {
    db,
    ctx,
    reset() {
      for (const k of Object.keys(db)) db[k] = [];
      ctx.user = null;
      idSeq = 0;
    },
    makeClient: () => ({ from: (t: string) => new Query(t) }),
  };
});

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: () => H.makeClient(),
}));
vi.mock("@/lib/auth/server", () => ({
  getVerifiedUser: async () => H.ctx.user,
}));

// Klaviyo is stubbed: capture the "Submitted Review" call without hitting the
// network, and toggle isKlaviyoConfigured() per test.
const KLAVIYO = vi.hoisted(() => ({
  track: vi.fn<(...args: unknown[]) => Promise<void>>(),
  configured: true,
}));
vi.mock("@/lib/klaviyo", () => ({
  trackKlaviyoEvent: (...args: unknown[]) => KLAVIYO.track(...args),
  isKlaviyoConfigured: () => KLAVIYO.configured,
}));

// Imported AFTER the mocks are declared. account.ts is NOT mocked — it runs for
// real against the same fake db, which is the whole point.
import { POST } from "./route";

// --- Fixtures ---------------------------------------------------------------
// Two metal variants of one logical piece + a decoy from another piece.
const PIECE = { name: "Aurora Ring", category_id: "cat-rings" };
const SILVER = "11111111-1111-1111-1111-111111111111";
const GOLD = "22222222-2222-2222-2222-222222222222";
const DECOY = "33333333-3333-3333-3333-333333333333";

function seedCatalogue() {
  H.db.products.push(
    { id: SILVER, ...PIECE, slug: "aurora-ring-silver", categories: { name: "Rings" } },
    { id: GOLD, ...PIECE, slug: "aurora-ring-gold", categories: { name: "Rings" } },
    { id: DECOY, name: "Nova Pendant", category_id: "cat-pendants", slug: "nova-pendant" },
  );
}

function seedProfile(id: string, first = "Jane", last = "Doe") {
  H.db.profiles.push({ id, first_name: first, last_name: last });
}

function seedGuestOrder(opts: {
  email: string;
  status?: string;
  userId?: string | null;
  productId?: string;
}) {
  const orderId = `order-${H.db.orders.length + 1}`;
  H.db.orders.push({
    id: orderId,
    email: opts.email,
    status: opts.status ?? "paid",
    user_id: opts.userId ?? null,
  });
  H.db.order_items.push({
    id: `item-${H.db.order_items.length + 1}`,
    order_id: orderId,
    product_id: opts.productId ?? SILVER,
  });
  return orderId;
}

function signIn(opts: {
  id?: string;
  email: string;
  verified?: boolean;
}) {
  H.ctx.user = {
    id: opts.id ?? "user-1",
    email: opts.email,
    email_confirmed_at:
      opts.verified === false ? null : "2026-07-20T00:00:00.000Z",
  };
}

async function postReview(body: unknown) {
  const req = new Request("http://test.local/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, json };
}

const VALID = { rating: 5, title: "Beautiful", body: "Wear it every day." };

async function deleteReview(productId: string) {
  const { DELETE } = await import("@/app/api/reviews/route");
  const res = await DELETE(
    new Request(`http://localhost/api/reviews?productId=${productId}`, {
      method: "DELETE",
    }),
  );
  return { status: res.status, json: await res.json().catch(() => null) };
}

beforeEach(() => {
  H.reset();
  seedCatalogue();
  KLAVIYO.track.mockClear();
  KLAVIYO.configured = true;
});

describe("DELETE /api/reviews", () => {
  it("removes the caller's own review and rewrites the piece aggregate", async () => {
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });
    await postReview({ productId: GOLD, ...VALID });
    expect(H.db.reviews).toHaveLength(1);

    // Deleting from the SILVER page must still find the review left on GOLD —
    // one review spans the whole piece.
    const { status, json } = await deleteReview(SILVER);

    expect(status).toBe(200);
    expect((json?.deleted as string[]).length).toBe(1);
    expect(H.db.reviews).toHaveLength(0);

    // The cache has to fall back to "no reviews" across every variant, or the
    // PDP header and shop cards keep advertising a rating nobody left.
    const silver = H.db.products.find((p) => p.id === SILVER)!;
    const gold = H.db.products.find((p) => p.id === GOLD)!;
    expect(silver.review_count).toBe(0);
    expect(gold.review_count).toBe(0);
    expect(silver.rating).toBeNull();
  });

  it("never touches someone else's review of the same piece", async () => {
    // Two reviewers on one piece; user-1 deletes. user-2's must survive, and
    // the aggregate must reflect the one that remains.
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });
    await postReview({ productId: SILVER, rating: 2, body: "Not for me." });

    seedProfile("user-2", "Sam", "K");
    signIn({ id: "user-2", email: "sam@x.com" });
    await postReview({ productId: SILVER, rating: 4, body: "Lovely." });
    expect(H.db.reviews).toHaveLength(2);

    signIn({ id: "user-1", email: "jane@x.com" });
    const { status } = await deleteReview(SILVER);

    expect(status).toBe(200);
    expect(H.db.reviews).toHaveLength(1);
    expect(H.db.reviews[0].user_id).toBe("user-2");

    const silver = H.db.products.find((p) => p.id === SILVER)!;
    expect(silver.review_count).toBe(1);
    expect(silver.rating).toBe(4);
  });

  it("404s when the caller has no review to delete", async () => {
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });

    const { status, json } = await deleteReview(SILVER);

    expect(status).toBe(404);
    expect(json?.error).toBe("review_not_found");
  });

  it("404s rather than deleting when another shopper reviewed but the caller did not", async () => {
    seedProfile("user-2", "Sam", "K");
    signIn({ id: "user-2", email: "sam@x.com" });
    await postReview({ productId: SILVER, ...VALID });

    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });
    const { status, json } = await deleteReview(SILVER);

    expect(status).toBe(404);
    expect(json?.error).toBe("review_not_found");
    expect(H.db.reviews).toHaveLength(1);
  });

  it("requires a signed-in session", async () => {
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });
    await postReview({ productId: SILVER, ...VALID });

    H.ctx.user = null;
    const { status, json } = await deleteReview(SILVER);

    expect(status).toBe(401);
    expect(json?.error).toBe("unauthorised");
    expect(H.db.reviews).toHaveLength(1);
  });

  it("rejects a malformed productId", async () => {
    signIn({ id: "user-1", email: "jane@x.com" });
    const { status } = await deleteReview("not-a-uuid");
    expect(status).toBe(400);
  });
});

describe("POST /api/reviews — no purchase gate", () => {
  it("accepts a signed-in shopper who has never ordered anything", async () => {
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" }); // no orders at all

    const { status, json } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(201);
    const review = json?.review as Record<string, unknown>;
    expect(review.user_id).toBe("user-1");
    expect(review.author_name).toBe("Jane D.");
    expect(H.db.reviews).toHaveLength(1);
  });

  it("accepts a shopper who only ever bought a different piece", async () => {
    // A paid order exists but for a DIFFERENT piece (decoy), plus an unrelated
    // person's order for this piece. Neither is a reason to refuse.
    H.db.orders.push({ id: "o-other", email: "someone@else.com", status: "paid", user_id: "user-9" });
    H.db.order_items.push({ id: "i-other", order_id: "o-other", product_id: SILVER });
    seedGuestOrder({ email: "jane@x.com", userId: "user-1", productId: DECOY });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });

    const { status } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(201);
    expect(H.db.reviews).toHaveLength(1);
  });

  it("accepts a shopper whose only order for the piece is unpaid", async () => {
    seedGuestOrder({ email: "jane@x.com", userId: "user-1", status: "pending" });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });

    const { status } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(201);
  });

  it("still writes the piece-wide aggregate cache for a non-buyer's review", async () => {
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });

    await postReview({ productId: GOLD, rating: 4, body: "Lovely in person." });

    const silver = H.db.products.find((p) => p.id === SILVER)!;
    const gold = H.db.products.find((p) => p.id === GOLD)!;
    expect(silver.review_count).toBe(1);
    expect(gold.review_count).toBe(1);
    expect(silver.rating).toBe(4);
  });

  it("still requires a signed-in session — open to accounts, not to anyone", async () => {
    H.ctx.user = null;
    const { status, json } = await postReview({ productId: SILVER, ...VALID });
    expect(status).toBe(401);
    expect(json?.error).toBe("unauthorised");
    expect(H.db.reviews).toHaveLength(0);
  });
});

describe("POST /api/reviews — guest-order claiming", () => {
  it("claims an unattached guest order during the request", async () => {
    // Bought SILVER as a guest; account created afterwards; reviewing on the
    // GOLD variant page. Nothing has claimed the order yet (the OTP-path gap).
    const orderId = seedGuestOrder({ email: "jane@x.com", productId: SILVER });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });

    const { status, json } = await postReview({ productId: GOLD, ...VALID });

    expect(status).toBe(201);
    const review = json?.review as Record<string, unknown>;
    expect(review.user_id).toBe("user-1");
    expect(review.product_id).toBe(GOLD);
    expect(review.rating).toBe(5);
    expect(review.author_name).toBe("Jane D.");

    // The claim ran INSIDE the review request — the order is now attached.
    const order = H.db.orders.find((o) => o.id === orderId)!;
    expect(order.user_id).toBe("user-1");

    // Aggregate cache written across every variant of the piece.
    const silver = H.db.products.find((p) => p.id === SILVER)!;
    const gold = H.db.products.find((p) => p.id === GOLD)!;
    expect(silver.review_count).toBe(1);
    expect(gold.review_count).toBe(1);
    expect(silver.rating).toBe(5);

    // The reward event fired once, keyed by the buyer's email.
    expect(KLAVIYO.track).toHaveBeenCalledTimes(1);
    const [name, customer, props] = KLAVIYO.track.mock.calls[0] as unknown as [
      string,
      { email: string; first_name?: string | null },
      Record<string, unknown>,
    ];
    expect(name).toBe("Submitted Review");
    expect(customer.email).toBe("jane@x.com");
    expect(customer.first_name).toBe("Jane");
    expect(props.ProductName).toBe("Aurora Ring");
    expect(props.Rating).toBe(5);
    expect(props.$event_id).toBe(review.id);
    expect(props.ProductCategories).toEqual(["Rings"]);
  });

  it("matches the order email case-insensitively when claiming", async () => {
    seedGuestOrder({ email: "jane@x.com" });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "JANE@X.com" });

    const { status } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(201);
    expect(H.db.orders[0].user_id).toBe("user-1");
  });

  it("does NOT over-claim a plus-aliased / differently-spelled email", async () => {
    // Deliberate design: claiming is an exact match, not canonicalised. The
    // review is still accepted — claiming has nothing to do with that any more.
    seedGuestOrder({ email: "jane@x.com" });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane+shop@x.com" });

    const { status } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(201);
    expect(H.db.orders[0].user_id).toBeNull(); // never attached
  });

  it("claims regardless of order status", async () => {
    const orderId = seedGuestOrder({ email: "jane@x.com", status: "pending" });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });

    const { status } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(201);
    expect(H.db.orders.find((o) => o.id === orderId)!.user_id).toBe("user-1");
  });

  it("does not claim when the user's email is unverified", async () => {
    seedGuestOrder({ email: "jane@x.com" });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com", verified: false });

    const { status } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(201);
    expect(H.db.orders[0].user_id).toBeNull();
  });
});

describe("POST /api/reviews — existing behaviour still holds", () => {
  it("accepts an already-attached order (Google / magic-link path) unchanged", async () => {
    seedGuestOrder({ email: "jane@x.com", userId: "user-1" });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });

    const { status, json } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(201);
    expect((json?.review as Record<string, unknown>).user_id).toBe("user-1");
  });

  it("updates the existing review instead of duplicating across variants", async () => {
    seedGuestOrder({ email: "jane@x.com", productId: SILVER });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });

    const first = await postReview({ productId: GOLD, rating: 5, body: "Love it." });
    expect(first.status).toBe(201);

    // Same piece, different variant, second submission → update, not insert.
    const second = await postReview({ productId: SILVER, rating: 3, body: "On reflection, okay." });
    expect(second.status).toBe(200);

    expect(H.db.reviews).toHaveLength(1);
    expect(H.db.reviews[0].rating).toBe(3);

    const silver = H.db.products.find((p) => p.id === SILVER)!;
    expect(silver.review_count).toBe(1);
    expect(silver.rating).toBe(3);

    // The reward fires on the create only — the edit must not re-trigger it.
    expect(KLAVIYO.track).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for a malformed productId", async () => {
    signIn({ id: "user-1", email: "jane@x.com" });
    const { status } = await postReview({ productId: "not-a-uuid", ...VALID });
    expect(status).toBe(400);
  });

  it("returns 400 for an invalid rating", async () => {
    seedGuestOrder({ email: "jane@x.com" });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });
    const { status, json } = await postReview({ productId: SILVER, rating: 9, body: "x" });
    expect(status).toBe(400);
    expect(json?.error).toBe("invalid_rating");
  });

  it("returns 404 for an unknown product", async () => {
    signIn({ id: "user-1", email: "jane@x.com" });
    const { status, json } = await postReview({
      productId: "44444444-4444-4444-4444-444444444444",
      ...VALID,
    });
    expect(status).toBe(404);
    expect(json?.error).toBe("product_not_found");
  });
});

describe("POST /api/reviews — Klaviyo 'Submitted Review' event", () => {
  it("fires for a first-time reviewer who never bought the piece", async () => {
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" }); // no order at all

    const { status } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(201);
    expect(KLAVIYO.track).toHaveBeenCalledTimes(1);
  });

  it("does not fire when the request never reaches a saved review", async () => {
    H.ctx.user = null;

    const { status } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(401);
    expect(KLAVIYO.track).not.toHaveBeenCalled();
  });

  it("still saves the review (201) when Klaviyo is not configured", async () => {
    KLAVIYO.configured = false;
    seedGuestOrder({ email: "jane@x.com", productId: SILVER });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });

    const { status } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(201);
    expect(H.db.reviews).toHaveLength(1);
    expect(KLAVIYO.track).not.toHaveBeenCalled();
  });

  it("never lets a Klaviyo failure fail an already-saved review", async () => {
    KLAVIYO.track.mockRejectedValueOnce(new Error("klaviyo 503"));
    seedGuestOrder({ email: "jane@x.com", productId: SILVER });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });

    const { status, json } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(201);
    expect((json?.review as Record<string, unknown>).rating).toBe(5);
    expect(H.db.reviews).toHaveLength(1);
    expect(KLAVIYO.track).toHaveBeenCalledTimes(1);
  });
});
