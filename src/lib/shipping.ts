/**
 * Shipping cost estimator.
 *
 * Same function powers both the live shipping quote in CheckoutClient and
 * the authoritative price written onto the order in /api/checkout. Both
 * paths MUST go through this function so the user never sees a different
 * total than what gets persisted.
 *
 * Pricing model:
 * - R600+ subtotal -> free shipping
 * - Otherwise a flat R80, regardless of weight or destination.
 */

export interface ShippingEstimateLine {
  quantity: number;
  weightKg?: number;
  value?: number;
}

export interface ShippingEstimateDestination {
  country: string;
  city: string;
  postalCode: string;
}

export interface ShippingEstimateOptions {
  lines: ShippingEstimateLine[];
  subtotal: number;
  destination: ShippingEstimateDestination;
}

const FREE_SHIPPING_THRESHOLD = 600;
const FLAT_SHIPPING_COST = 80;

export function estimateShippingCost(options: ShippingEstimateOptions): number {
  if (options.subtotal >= FREE_SHIPPING_THRESHOLD) {
    return 0;
  }
  return FLAT_SHIPPING_COST;
}
