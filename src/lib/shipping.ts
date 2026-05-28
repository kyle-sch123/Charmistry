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
 * - Domestic (ZA): R45 base + R30/kg, floored at R55
 * - International: R120 base + R55/kg, floored at R55
 *
 * Each line is assumed to be 0.5kg unless a weight is supplied. Update
 * DOMESTIC_PER_KG / INTERNATIONAL_PER_KG together so the per-kg gap stays
 * roughly proportional to courier pricing.
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
const DOMESTIC_BASE_COST = 45;
const DOMESTIC_PER_KG = 30;
const INTERNATIONAL_BASE_COST = 120;
const INTERNATIONAL_PER_KG = 55;
const MINIMUM_COST = 55;
const DEFAULT_ITEM_WEIGHT_KG = 0.5;

export function estimateShippingCost(options: ShippingEstimateOptions): number {
  if (options.subtotal >= FREE_SHIPPING_THRESHOLD) {
    return 0;
  }

  const totalWeight = options.lines.reduce((sum, line) => {
    const weight = line.weightKg ?? DEFAULT_ITEM_WEIGHT_KG;
    return sum + weight * Math.max(1, line.quantity);
  }, 0);

  const weightKg = Math.max(totalWeight, DEFAULT_ITEM_WEIGHT_KG);
  const destinationCountry =
    options.destination.country?.trim().toUpperCase() ?? "ZA";
  const domestic = destinationCountry === "ZA";

  const baseCost = domestic ? DOMESTIC_BASE_COST : INTERNATIONAL_BASE_COST;
  const perKg = domestic ? DOMESTIC_PER_KG : INTERNATIONAL_PER_KG;

  const cost = baseCost + weightKg * perKg;
  return Number(Math.max(cost, MINIMUM_COST).toFixed(2));
}
