/**
 * Cart-aware bundle discounts.
 *
 * Unlike discount codes (see lib/discounts.ts), a bundle isn't a typed-in code
 * checked against a subtotal — it is detected from the *contents* of the cart.
 * The Everyday Edit bundle only applies when every piece of the edit is in the
 * bag, which is what makes it both:
 *   - automatic  — no code to type, no email gate; the price is just right.
 *   - unabusable — it can't be applied to a random R710 cart of other items,
 *     because the discount is keyed to the specific product slugs.
 *
 * This module is pure (no server/browser imports) so the SAME function runs in
 * CheckoutClient (to show the price) and in /api/checkout (the authority that
 * actually charges it). They can never diverge.
 */

export interface BundleDefinition {
  /** Stored on the order's discount_code column for records/reporting. */
  code: string;
  /** Customer-facing label shown in the cart/checkout summary. */
  label: string;
  /** Every slug must be present (qty >= 1) for one complete set. */
  itemSlugs: string[];
  /** ZAR taken off per complete set of the bundle. */
  discountPerSet: number;
}

export const EVERYDAY_EDIT_BUNDLE: BundleDefinition = {
  code: "EVERYDAY-EDIT",
  label: "Everyday Edit bundle",
  itemSlugs: [
    "nova-necklaces-gold",
    "lucy-necklaces-gold",
    "kira-earrings-gold",
    "sole-rings-gold",
    "mila-bracelets-gold",
  ],
  discountPerSet: 110,
};

export const BUNDLES: BundleDefinition[] = [EVERYDAY_EDIT_BUNDLE];

export interface BundleLine {
  slug: string | null | undefined;
  quantity: number;
}

export interface ResolvedBundle {
  code: string;
  label: string;
  /** Total ZAR discount (discountPerSet × complete sets). */
  amount: number;
  /** Number of complete sets of the bundle found in the cart. */
  sets: number;
}

/**
 * Resolve the best applicable bundle discount for a cart, or null if none
 * applies. "Sets" is the number of complete bundles present — buy two of every
 * edit piece and the discount doubles. The amount is NOT yet capped to the
 * subtotal; the caller should Math.min it against the subtotal.
 */
export function resolveBundleDiscount(
  lines: BundleLine[],
): ResolvedBundle | null {
  const qtyBySlug = new Map<string, number>();
  for (const line of lines) {
    if (!line.slug) continue;
    const qty = Math.floor(Number(line.quantity));
    if (!Number.isFinite(qty) || qty < 1) continue;
    qtyBySlug.set(line.slug, (qtyBySlug.get(line.slug) ?? 0) + qty);
  }

  let best: ResolvedBundle | null = null;
  for (const bundle of BUNDLES) {
    let sets = Infinity;
    for (const slug of bundle.itemSlugs) {
      sets = Math.min(sets, qtyBySlug.get(slug) ?? 0);
    }
    if (!Number.isFinite(sets) || sets < 1) continue;

    const amount = Number((bundle.discountPerSet * sets).toFixed(2));
    if (!best || amount > best.amount) {
      best = { code: bundle.code, label: bundle.label, amount, sets };
    }
  }
  return best;
}
