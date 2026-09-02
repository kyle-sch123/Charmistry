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
 * "Free" shown in the bag/checkout matches the charge.
 *
 * Free shipping comes in TWO tiers, cheaper method first:
 * - discounted total >= R500 -> Locker-to-Locker is free. Standard Economy is
 *   NOT: door-to-door still costs its flat R79 in this band. The two tiers are
 *   independent, not a credit — R500 buys the locker method, nothing else.
 * - discounted total >= R700 -> free on any method, door delivery included.
 *
 * And, unchanged:
 * - discounted total <= R0 (a comp / 100%-off order) -> free too; we don't
 *   charge shipping on an order with nothing to pay for, which keeps the
 *   zero-total (PayFast-skip) path reachable.
 * - a cart-earned shipping perk (see resolveShippingPerk in lib/bundles.ts):
 *   "all_methods" (the Everyday Edit, The Daily Affair) ships free on any
 *   method at any total — still worth having below R700, which is the band the
 *   perk now earns its keep in. "locker_only" frees the locker method alone;
 *   no promo grants it today (the stacks pay out as money off), and the R500
 *   tier now expresses the same shape by spend rather than by cart contents.
 * - otherwise the chosen method's flat price.
 *
 * The carrier is recorded on the order either way, so fulfilment always knows
 * how to ship — free means not charged, never unspecified.
 *
 * This module is pure (no server-only imports) so it is the single source of
 * truth for BOTH the client price shown in CheckoutClient and the authoritative
 * price recomputed in /api/checkout — they can never diverge. The client never
 * gets to assert a price; the server re-derives it from the chosen method id.
 */

/** Spend at which Locker-to-Locker ships free. Door delivery still costs. */
export const FREE_LOCKER_THRESHOLD = 500;

/** Spend at which EVERY method ships free, door-to-door included. */
export const FREE_DOOR_THRESHOLD = 700;

export type ShippingMethodId = "pudo_locker" | "courier_economy";

/**
 * A shipping perk earned by the cart's contents (resolved in lib/bundles.ts):
 * - "locker_only"  — the locker-to-locker method ships free; other methods
 *   keep their flat price. No promo currently grants this tier.
 * - "all_methods"  — every method ships free (the Everyday Edit reward).
 */
export type ShippingPerk = "locker_only" | "all_methods";

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
 * merchandise total. Checks run cheapest-to-qualify first:
 *
 *   amount <= 0                       -> free (comp / 100%-off order)
 *   amount >= FREE_DOOR_THRESHOLD     -> free, any method
 *   amount >= FREE_LOCKER_THRESHOLD   -> free for the LOCKER method only
 *   perk "all_methods"                -> free, any method
 *   perk "locker_only"                -> free for the locker method only
 *   otherwise                         -> the method's flat price
 *
 * Unknown ids resolve to 0 (the caller is expected to have validated the id).
 */
export function shippingCostForMethod(
  methodId: ShippingMethodId,
  amount: number,
  perk?: ShippingPerk | null,
): number {
  if (amount <= 0) return 0;
  if (amount >= FREE_DOOR_THRESHOLD) return 0;
  if (amount >= FREE_LOCKER_THRESHOLD && methodId === "pudo_locker") return 0;
  if (perk === "all_methods") return 0;
  if (perk === "locker_only" && methodId === "pudo_locker") return 0;
  return findMethod(methodId)?.price ?? 0;
}

/** What the cart's free-shipping bar needs to know, derived in one place. */
export interface FreeShippingProgress {
  /** Locker-to-Locker ships free at this total. */
  lockerFree: boolean;
  /** Every method ships free, door delivery included. */
  doorFree: boolean;
  /** The next tier still to reach, or null once door delivery is free. */
  nextThreshold: number | null;
  /** ZAR still to spend to reach nextThreshold; 0 when there is nothing left. */
  remaining: number;
  /** Bar fill 0–100, scaled so the track ends at FREE_DOOR_THRESHOLD. */
  progress: number;
}

/**
 * Resolve the cart bar's two-milestone state from the same inputs the price
 * uses, so the bar can never promise a tier the charge won't honour. Kept here
 * rather than in CartDrawer for exactly that reason — and so it is testable.
 *
 * A perk unlocks its tier outright, below either threshold; the bar still fills
 * proportionally to spend so a perk-holding cart doesn't sit at a misleading
 * 100% while the shopper adds more.
 */
export function resolveFreeShippingProgress(
  amount: number,
  perk?: ShippingPerk | null,
): FreeShippingProgress {
  const lockerFree =
    shippingCostForMethod("pudo_locker", amount, perk) === 0;
  const doorFree =
    shippingCostForMethod("courier_economy", amount, perk) === 0;

  const nextThreshold = doorFree
    ? null
    : lockerFree
      ? FREE_DOOR_THRESHOLD
      : FREE_LOCKER_THRESHOLD;

  return {
    lockerFree,
    doorFree,
    nextThreshold,
    remaining: nextThreshold === null ? 0 : Math.max(0, nextThreshold - amount),
    progress: doorFree
      ? 100
      : Math.min(100, Math.max(0, (amount / FREE_DOOR_THRESHOLD) * 100)),
  };
}

/** Where the locker milestone sits along a bar that ends at the door tier. */
export const LOCKER_MILESTONE_PERCENT =
  (FREE_LOCKER_THRESHOLD / FREE_DOOR_THRESHOLD) * 100;
