/**
 * Route-level tests for POST /api/reviews, focused on the guest-order claiming
 * gap: a buyer who checked out as a guest and only created an account later
 * must still be able to review the piece they bought.
 *
 * These are integration-style: a small in-memory fake Supabase stands in for
 * the service-role client and is SHARED between the route and the *real*
 * ensureProfileAndClaimOrders (both resolve createServerSupabase from the same
 * mocked module). That means the claim genuinely flips orders.user_id and the
 * purchase gate genuinely reads it back — so "the review succeeded" proves the
 * claim actually ran inside the request, not that a spy was called.
 *
 * The fake implements only the query shapes these two modules use (select /
 * insert / update / upsert with eq / is / in / ilike / limit / maybeSingle /
 * single, plus the order_items→orders!inner join the purchase gate relies on).
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
    private op: "select" | "insert" | "update" | "upsert" = "select";
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
    { id: SILVER, ...PIECE },
    { id: GOLD, ...PIECE },
    { id: DECOY, name: "Nova Pendant", category_id: "cat-pendants" },
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

beforeEach(() => {
  H.reset();
  seedCatalogue();
});

describe("POST /api/reviews — guest-order claiming gap", () => {
  it("claims an unattached guest order during the request, then accepts the review", async () => {
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
    // Deliberate design: claiming is an exact match, not canonicalised.
    seedGuestOrder({ email: "jane@x.com" });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane+shop@x.com" });

    const { status, json } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(403);
    expect(json?.error).toBe("not_purchased");
    expect(H.db.orders[0].user_id).toBeNull(); // never attached
    expect(H.db.reviews).toHaveLength(0);
  });

  it("claims the order but still rejects when it is not paid", async () => {
    const orderId = seedGuestOrder({ email: "jane@x.com", status: "pending" });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });

    const { status, json } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(403);
    expect(json?.error).toBe("not_purchased");
    // Claim is status-agnostic, so the row IS attached — the gate is what holds.
    expect(H.db.orders.find((o) => o.id === orderId)!.user_id).toBe("user-1");
  });

  it("does not claim (and rejects) when the user's email is unverified", async () => {
    seedGuestOrder({ email: "jane@x.com" });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com", verified: false });

    const { status, json } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(403);
    expect(json?.error).toBe("not_purchased");
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

  it("rejects an authenticated user who never bought the piece", async () => {
    // A paid order exists but for a DIFFERENT piece (decoy), plus an unrelated
    // person's order for this piece.
    H.db.orders.push({ id: "o-other", email: "someone@else.com", status: "paid", user_id: "user-9" });
    H.db.order_items.push({ id: "i-other", order_id: "o-other", product_id: SILVER });
    seedGuestOrder({ email: "jane@x.com", userId: "user-1", productId: DECOY });
    seedProfile("user-1");
    signIn({ id: "user-1", email: "jane@x.com" });

    const { status, json } = await postReview({ productId: SILVER, ...VALID });

    expect(status).toBe(403);
    expect(json?.error).toBe("not_purchased");
    expect(H.db.reviews).toHaveLength(0);
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
  });

  it("returns 401 when unauthenticated", async () => {
    H.ctx.user = null;
    const { status, json } = await postReview({ productId: SILVER, ...VALID });
    expect(status).toBe(401);
    expect(json?.error).toBe("unauthorised");
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
