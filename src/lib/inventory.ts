/**
 * Inventory mutations.
 *
 * Stock is validated at checkout but only DECREMENTED once a payment is
 * CONFIRMED: the PayFast ITN pending→paid winner, and the R0 (100%-off) order
 * that is created paid directly. The decrement runs through the
 * `decrement_product_stock` RPC (migration 006) so each product row is locked
 * and the decrement is atomic, clamped at 0 (never negative), and flips
 * in_stock=false at zero. Any oversell (paid qty > stock on hand) is reported
 * and logged for reconciliation — we never fail an already-paid order here.
 *
 * Scope note: decrementing at confirmation keeps stock counts correct and
 * surfaces oversells, but it does NOT reserve stock at checkout — two carts
 * that both check out while one unit remains can both pay (each is flagged as
 * oversold). Preventing that entirely would require a checkout-time reservation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface StockDecrementLine {
  product_id: string | null;
  quantity: number;
}

export async function decrementProductStock(
  supabase: SupabaseClient,
  lines: StockDecrementLine[],
): Promise<void> {
  const items = lines
    .filter((l) => l.product_id && Number(l.quantity) > 0)
    .map((l) => ({ product_id: l.product_id, qty: Math.floor(Number(l.quantity)) }));

  if (items.length === 0) return;

  // Best-effort: the order is already paid, so a decrement failure must never
  // throw out of the confirmation path — log loudly so it can be reconciled.
  let data: unknown = null;
  try {
    const res = await supabase.rpc("decrement_product_stock", { items });
    if (res.error) {
      console.error("decrementProductStock: rpc failed", { error: res.error, items });
      return;
    }
    data = res.data;
  } catch (err) {
    console.error("decrementProductStock: rpc threw", { err, items });
    return;
  }

  const oversold = (data as { oversold?: unknown[] } | null)?.oversold;
  if (Array.isArray(oversold) && oversold.length > 0) {
    console.error("decrementProductStock: OVERSOLD — stock clamped at 0", { oversold });
  }
}
