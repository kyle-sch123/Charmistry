/**
 * Read the owner's live shipping prices from the `shipping_rates` table
 * (migration 013), edited in /admin/catalogue.
 *
 * Kept out of lib/shipping.ts so that module stays pure (no I/O) and can keep
 * being imported by client components. The caller passes the Supabase client:
 * the checkout page reads with the anon client (prices are public — RLS allows
 * SELECT), /api/checkout with its service-role client.
 *
 * Never throws and never blocks a sale: a missing table (migration not applied
 * yet) or a failed read falls back to DEFAULT_SHIPPING_RATES, the prices the
 * shop charged before they were editable. The checkout page and /api/checkout
 * both load through here, so display and charge come from the same source.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_SHIPPING_RATES,
  ratesFromRows,
  type ShippingRates,
} from "./shipping";

/**
 * Error codes meaning "the shipping_rates table doesn't exist": Postgres'
 * undefined_table, and PostgREST's schema-cache miss for an unknown table.
 */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

/** True when a Supabase error means migration 013 hasn't been applied. */
export function isMissingTableError(
  error: { code?: string } | null | undefined,
): boolean {
  return !!error?.code && MISSING_TABLE_CODES.has(error.code);
}

export async function loadShippingRates(
  client: SupabaseClient,
): Promise<ShippingRates> {
  const { data, error } = await client
    .from("shipping_rates")
    .select("method_id, price");
  if (error) {
    // A missing table is the expected state between deploy and migration;
    // anything else is worth a log line, but still must not block checkout.
    if (!isMissingTableError(error)) {
      console.error("Shipping rates read failed; using defaults", error);
    }
    return DEFAULT_SHIPPING_RATES;
  }
  return ratesFromRows(data);
}
