/**
 * Shipping methods + cost resolution.
 *
 * Charmistry offers two carrier options at checkout, both fulfilled under The
 * Courier Guy umbrella:
 *   - Locker-to-Locker (R49) — collect from a nearby locker. The customer tells
 *     us their preferred locker in the order notes or by email; if none is
 *     given, we ship to the nearest available locker to their address.
 *   - Standard Economy (R79) — door-to-door delivery via The Courier Guy.
 *
 * Note: the `pudo_locker` method id is retained internally (the locker network
 * is PUDO under the hood) but is never surfaced to customers.
 *
 * Pricing model — evaluated on the DISCOUNTED merchandise total (what the
 * customer actually pays for goods), not the pre-discount subtotal, so the
 * "Free" shown in the bag/checkout matches the charge:
 * - discounted total >= R700 -> free shipping, whichever method is chosen (the
 *   carrier is still recorded so fulfilment knows how to ship — just not charged).
 * - discounted total <= R0 (a comp / 100%-off order) -> free too; we don't
 *   charge shipping on an order with nothing to pay for, which keeps the
 *   zero-total (PayFast-skip) path reachable.
 * - otherwise the chosen method's flat price.
 *
 * This module is pure (no server-only imports) so it is the single source of
 * truth for BOTH the client price shown in CheckoutClient and the authoritative
 * price recomputed in /api/checkout — they can never diverge. The client never
 * gets to assert a price; the server re-derives it from the chosen method id.
 */

export const FREE_SHIPPING_THRESHOLD = 700;

export type ShippingMethodId = "pudo_locker" | "courier_economy";

export interface ShippingMethodDef {
  id: ShippingMethodId;
  /** Customer-facing name, e.g. "Locker-to-Locker". */
  label: string;
  /** Fulfilment carrier, e.g. "The Courier Guy". */
  carrier: string;
  /** Flat price in ZAR before the free-shipping threshold is applied. */
  price: number;
  /** Rough delivery window, shown as a sub-label. */
  eta: string;
  /** One-line description of the method. */
  blurb: string;
}

export const SHIPPING_METHODS: readonly ShippingMethodDef[] = [
  {
    id: "pudo_locker",
    label: "Courier Guy Locker-to-Locker",
    carrier: "The Courier Guy",
    price: 49,
    eta: "2–4 working days",
    blurb: "Collect from any locker nationwide",
  },
  {
    id: "courier_economy",
    label: "Standard Economy",
    carrier: "The Courier Guy",
    price: 79,
    eta: "3–5 working days",
    blurb: "Delivery via The Courier Guy",
  },
] as const;

export const DEFAULT_SHIPPING_METHOD_ID: ShippingMethodId = "pudo_locker";

function findMethod(
  id: string | null | undefined,
): ShippingMethodDef | undefined {
  return SHIPPING_METHODS.find((m) => m.id === id);
}

/**
 * Turn a raw method id (from the client, or a stored order column) into its
 * definition. An empty / missing value falls back to the default method so the
 * flow is robust; a *non-empty but unknown* value returns null so the checkout
 * route can reject a tampered payload rather than silently mischarge.
 */
export function resolveShippingMethod(
  input: string | null | undefined,
): ShippingMethodDef | null {
  if (input == null || input === "") {
    return findMethod(DEFAULT_SHIPPING_METHOD_ID) ?? null;
  }
  return findMethod(input) ?? null;
}

/** Human-readable label for a stored method id (emails, admin). Null if unknown. */
export function shippingMethodLabel(
  id: string | null | undefined,
): string | null {
  return findMethod(id)?.label ?? null;
}

/**
 * The authoritative shipping cost for a chosen method at a given (discounted)
 * merchandise total. Free at/above the threshold, and free when the order is
 * fully covered by a discount (amount <= 0) so a comp/100%-off order isn't
 * charged shipping; otherwise the method's flat price. Unknown ids resolve to 0
 * (the caller is expected to have validated the id).
 */
export function shippingCostForMethod(
  methodId: ShippingMethodId,
  amount: number,
): number {
  if (amount <= 0 || amount >= FREE_SHIPPING_THRESHOLD) return 0;
  return findMethod(methodId)?.price ?? 0;
}
