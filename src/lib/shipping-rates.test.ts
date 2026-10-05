import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SHIPPING_RATES } from "@/lib/shipping";
import { isMissingTableError, loadShippingRates } from "@/lib/shipping-rates";

/** A client whose `from().select()` resolves to the given result. */
function fakeClient(result: { data: unknown; error: unknown }) {
  return {
    from: () => ({ select: () => Promise.resolve(result) }),
  } as unknown as SupabaseClient;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadShippingRates", () => {
  it("returns the owner's stored prices", async () => {
    const rates = await loadShippingRates(
      fakeClient({
        data: [
          { method_id: "pudo_locker", price: 65 },
          { method_id: "courier_economy", price: 85 },
        ],
        error: null,
      }),
    );
    expect(rates).toEqual({ pudo_locker: 65, courier_economy: 85 });
  });

  it("falls back to the defaults, quietly, before the migration is applied", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const rates = await loadShippingRates(
      fakeClient({ data: null, error: { code: "PGRST205", message: "no table" } }),
    );
    expect(rates).toEqual(DEFAULT_SHIPPING_RATES);
    expect(log).not.toHaveBeenCalled();
  });

  it("falls back to the defaults on any other failure, and logs it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const rates = await loadShippingRates(
      fakeClient({ data: null, error: { code: "57014", message: "timeout" } }),
    );
    expect(rates).toEqual(DEFAULT_SHIPPING_RATES);
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("isMissingTableError", () => {
  it("recognises Postgres and PostgREST missing-table codes only", () => {
    expect(isMissingTableError({ code: "42P01" })).toBe(true);
    expect(isMissingTableError({ code: "PGRST205" })).toBe(true);
    expect(isMissingTableError({ code: "23505" })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError({})).toBe(false);
  });
});
