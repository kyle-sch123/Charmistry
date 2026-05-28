/**
 * Discount code resolution + redemption.
 *
 * Why it exists:
 * Discount codes are race-prone — two parallel checkouts can both observe
 * `uses_count < max_uses` and both proceed unless the increment is
 * conditional. The `redeem_discount_code` Supabase RPC does the increment
 * under row-level locking so only one of the two wins.
 *
 * Architecture:
 * - resolveDiscount() — read-only validation. Use it from /api/discount/validate
 *   and from the checkout pricing pass. It DOES NOT consume the code.
 * - consumeDiscount() — RPC call that conditionally increments uses_count.
 *   Returns false if the code is already exhausted at the moment of the call.
 * - refundDiscount() — decrement; used when a step after consume fails
 *   (e.g. PayFast payment-request build erroring out).
 *
 * The split between resolve and consume lets the checkout flow validate
 * pricing first, persist the order, and only consume the code at the last
 * safe moment. See src/app/api/checkout/route.ts for the ordering.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DiscountCode } from "@/types";

export type DiscountError =
  | "not_found"
  | "inactive"
  | "expired"
  | "max_uses_reached"
  | "min_order_not_met"
  | "email_mismatch";

export interface DiscountResolution {
  code: DiscountCode;
  /** Final discount in ZAR, rounded to 2dp. Always <= subtotal. */
  amount: number;
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

/**
 * Look up a code and validate it against the subtotal + customer email.
 * Returns either the resolved discount or a DiscountError string.
 */
export async function resolveDiscount(
  supabase: SupabaseClient,
  rawCode: string,
  subtotal: number,
  customerEmail?: string,
): Promise<DiscountResolution | DiscountError> {
  const code = normalizeCode(rawCode);
  if (!code) return "not_found";

  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle<DiscountCode>();

  if (error || !data) return "not_found";
  if (!data.active) return "inactive";
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return "expired";
  }
  if (data.max_uses != null && data.uses_count >= data.max_uses) {
    return "max_uses_reached";
  }
  if (Number(data.min_order_amount) > subtotal) return "min_order_not_met";
  // Email-bound codes require the customer's email and must match exactly.
  // Missing email no longer bypasses the check.
  if (data.email) {
    if (!customerEmail) return "email_mismatch";
    if (data.email.toLowerCase() !== customerEmail.toLowerCase()) {
      return "email_mismatch";
    }
  }

  return { code: data, amount: computeDiscountAmount(data, subtotal) };
}

export function computeDiscountAmount(code: DiscountCode, subtotal: number): number {
  const raw = code.discount_type === "percentage"
    ? subtotal * (Number(code.discount_value) / 100)
    : Number(code.discount_value);
  return Number(Math.min(raw, subtotal).toFixed(2));
}

/**
 * Atomically increment uses_count iff the code is still redeemable.
 * Backed by the `redeem_discount_code` RPC which does a conditional UPDATE
 * under row-level locking — race-safe against concurrent checkouts.
 * Returns true on success, false if the code was exhausted/deactivated.
 */
export async function consumeDiscount(
  supabase: SupabaseClient,
  codeId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("redeem_discount_code", {
    code_id: codeId,
  });
  if (error) {
    console.error("redeem_discount_code rpc failed", error);
    return false;
  }
  return Boolean(data);
}

/**
 * Refund a previously-consumed use. Used when an order insert fails after
 * consumeDiscount succeeded. Non-blocking — if this errors we just log.
 */
export async function refundDiscount(
  supabase: SupabaseClient,
  codeId: string,
): Promise<void> {
  const { error } = await supabase.rpc("refund_discount_code", { code_id: codeId });
  if (error) console.error("refund_discount_code rpc failed", error);
}
