/**
 * Cart-aware bundle discounts + cart-earned shipping perks.
 *
 * Unlike discount codes (see lib/discounts.ts), a bundle isn't a typed-in code
 * checked against a subtotal — it is detected from the *contents* of the cart.
 * The Everyday Edit bundle only applies when every piece of the edit is in the
 * bag, which is what makes it both:
 *   - automatic  — no code to type, no email gate; the price is just right.
 *   - unabusable — it can't be applied to a random R710 cart of other items,
 *     because the discount is keyed to the specific product slugs.
 *
 * Rewards come in two independent tracks, resolved separately:
 *   - a ZAR discount        — resolveBundleDiscount(). Slug bundles only (the
 *     Everyday Edit's R175 per set).
 *   - a shipping perk       — resolveShippingPerk(). The category/mix stacks
 *     reward free locker-to-locker shipping (NOT a percentage off — that was
 *     the old promo), and the Everyday Edit adds free delivery on any method
 *     on top of its ZAR discount.
 * Because a stack no longer produces a ZAR discount, it no longer suppresses
 * typed discount codes — a shopper with a qualifying stack can still redeem a
 * code; they simply also collect their locker shipping for free.
 *
 * This module is pure (no server/browser imports) so the SAME function runs in
 * CheckoutClient (to show the price) and in /api/checkout (the authority that
 * actually charges it). They can never diverge.
 */

import type { ShippingPerk } from "./shipping";

export interface BundleDefinition {
  /** Stored on the order's discount_code column for records/reporting. */
  code: string;
  /** Customer-facing label shown in the cart/checkout summary. */
  label: string;
  /** Every slug must be present (qty >= 1) for one complete set. */
  itemSlugs: string[];
  /** ZAR taken off per complete set of the bundle. */
  discountPerSet: number;
  /** Shipping perk granted on top of the ZAR discount, if any. */
  shippingPerk?: ShippingPerk;
}

export const EVERYDAY_EDIT_BUNDLE: BundleDefinition = {
  code: "EVERYDAY-EDIT",
  label: "Everyday Edit bundle",
  itemSlugs: [
    "nova-necklaces-gold",
    "lucy-necklaces-gold",
    // The edit's earring piece is Sia (see EDIT in collections/everyday/page.tsx).
    // These slugs MUST match that list exactly or the bundle never completes and
    // no discount reaches checkout — keep the two in sync.
    "sia-earrings-gold",
    "sole-rings-gold",
    "mila-bracelets-gold",
  ],
  discountPerSet: 175,
  shippingPerk: "all_methods",
};

export const BUNDLES: BundleDefinition[] = [EVERYDAY_EDIT_BUNDLE];

/**
 * A category "stack & save" — a shipping perk earned once the cart holds at
 * least `minQuantity` pieces from a given category. Like a slug bundle it is
 * cart-aware and automatic; unlike one it awards free locker-to-locker
 * shipping rather than money off the goods.
 */
export interface CategoryStackDefinition {
  /** Identifier for records/analytics (not stored on orders — perks are
   *  visible as shipping_cost = 0). */
  code: string;
  /** Customer-facing label shown in the cart/checkout summary. */
  label: string;
  /** Category slug every qualifying line must match (e.g. "rings"). */
  category: string;
  /** Minimum total quantity in the category to unlock the perk. */
  minQuantity: number;
  /** The shipping perk unlocked by the stack. */
  shippingPerk: ShippingPerk;
}

/**
 * Stack & Save: any 3 rings → free locker-to-locker shipping. Unlocks once the
 * cart holds 3+ rings. Keep the /shop rings banner copy driven off this config
 * so the promo shown and the perk granted can never drift.
 */
export const RINGS_STACK: CategoryStackDefinition = {
  code: "RINGS-STACK",
  label: "Stack & Save · rings",
  category: "rings",
  minQuantity: 3,
  shippingPerk: "locker_only",
};

export const CATEGORY_STACKS: CategoryStackDefinition[] = [RINGS_STACK];

/**
 * A cross-category "mix & match stack" — one piece from each of several
 * categories unlocks the perk. The sibling of CategoryStackDefinition (one
 * category, quantity threshold): here the threshold is *breadth*, not depth —
 * the cart must hold at least one piece from every listed category.
 */
export interface MixStackDefinition {
  /** Identifier for records/analytics (not stored on orders — perks are
   *  visible as shipping_cost = 0). */
  code: string;
  /** Customer-facing label shown in the cart/checkout summary. */
  label: string;
  /** Category slugs — the cart needs at least one piece from each. */
  categories: string[];
  /** The shipping perk unlocked by the stack. */
  shippingPerk: ShippingPerk;
}

/**
 * Create Your Own Stack: a necklace + earrings + a bracelet → free
 * locker-to-locker shipping, automatically at checkout. Keep the PDP
 * StackBuilder copy driven off this config so the promo shown and the perk
 * granted can never drift.
 */
export const MIX_MATCH_STACK: MixStackDefinition = {
  code: "MIX-STACK",
  label: "Create Your Own Stack",
  categories: ["necklaces", "earrings", "bracelets"],
  shippingPerk: "locker_only",
};

export const MIX_STACKS: MixStackDefinition[] = [MIX_MATCH_STACK];

export interface BundleLine {
  slug: string | null | undefined;
  /** Category slug of the line's product — required for category stacks. */
  category?: string | null;
  /** Unit price (ZAR) — kept for callers that still pass it; the resolvers
   *  no longer price anything off it since stacks became shipping perks. */
  price?: number | null;
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

export interface ResolvedShippingPerk {
  /** Code of the bundle/stack that earned the perk (for UI/analytics). */
  code: string;
  /** Customer-facing label of the promo that earned the perk. */
  label: string;
  /** Which methods ship free — see ShippingPerk in lib/shipping.ts. */
  perk: ShippingPerk;
}

/** Sum cart quantities per slug, ignoring malformed lines. */
function tallyBySlug(lines: BundleLine[]): Map<string, number> {
  const qtyBySlug = new Map<string, number>();
  for (const line of lines) {
    if (!line.slug) continue;
    const qty = Math.floor(Number(line.quantity));
    if (!Number.isFinite(qty) || qty < 1) continue;
    qtyBySlug.set(line.slug, (qtyBySlug.get(line.slug) ?? 0) + qty);
  }
  return qtyBySlug;
}

/** Complete sets of a slug bundle present in the tallied cart (0 if none). */
function completeSets(
  qtyBySlug: Map<string, number>,
  bundle: BundleDefinition,
): number {
  let sets = Infinity;
  for (const slug of bundle.itemSlugs) {
    sets = Math.min(sets, qtyBySlug.get(slug) ?? 0);
  }
  return Number.isFinite(sets) ? sets : 0;
}

/**
 * Resolve the best applicable cart-aware ZAR discount, or null if none
 * applies. Only slug bundles (fixed ZAR per complete set, e.g. the Everyday
 * Edit) compete here — the category/mix stacks award shipping perks instead
 * (see resolveShippingPerk) and never appear as a discount line. The amount is
 * NOT yet capped to the subtotal; the caller should Math.min it against the
 * subtotal.
 */
export function resolveBundleDiscount(
  lines: BundleLine[],
): ResolvedBundle | null {
  const qtyBySlug = tallyBySlug(lines);

  let best: ResolvedBundle | null = null;
  for (const bundle of BUNDLES) {
    const sets = completeSets(qtyBySlug, bundle);
    if (sets < 1) continue;

    const amount = Number((bundle.discountPerSet * sets).toFixed(2));
    if (!best || amount > best.amount) {
      best = { code: bundle.code, label: bundle.label, amount, sets };
    }
  }
  return best;
}

/**
 * Resolve the best cart-earned shipping perk, or null if none applies.
 * Checked independently of resolveBundleDiscount — a cart can hold both a ZAR
 * discount (Everyday Edit) and a perk, or a perk alone (the stacks). When
 * several promos qualify, "all_methods" beats "locker_only"; within the same
 * tier the first match wins (bundles, then mix stacks, then category stacks).
 */
export function resolveShippingPerk(
  lines: BundleLine[],
): ResolvedShippingPerk | null {
  const candidates: ResolvedShippingPerk[] = [];

  const qtyBySlug = tallyBySlug(lines);
  for (const bundle of BUNDLES) {
    if (!bundle.shippingPerk) continue;
    if (completeSets(qtyBySlug, bundle) < 1) continue;
    candidates.push({
      code: bundle.code,
      label: bundle.label,
      perk: bundle.shippingPerk,
    });
  }

  for (const stack of MIX_STACKS) {
    if (!mixStackQualifies(lines, stack)) continue;
    candidates.push({
      code: stack.code,
      label: stack.label,
      perk: stack.shippingPerk,
    });
  }

  for (const stack of CATEGORY_STACKS) {
    if (!categoryStackQualifies(lines, stack)) continue;
    candidates.push({
      code: stack.code,
      label: stack.label,
      perk: stack.shippingPerk,
    });
  }

  if (candidates.length === 0) return null;
  return candidates.find((c) => c.perk === "all_methods") ?? candidates[0];
}

/** True when the cart holds at least minQuantity pieces of the stack's category. */
function categoryStackQualifies(
  lines: BundleLine[],
  stack: CategoryStackDefinition,
): boolean {
  let qty = 0;
  for (const line of lines) {
    if (line.category !== stack.category) continue;
    const q = Math.floor(Number(line.quantity));
    if (!Number.isFinite(q) || q < 1) continue;
    qty += q;
  }
  return qty >= stack.minQuantity;
}

/** True when the cart holds at least one piece from every listed category. */
function mixStackQualifies(
  lines: BundleLine[],
  stack: MixStackDefinition,
): boolean {
  const qtyByCategory = new Map<string, number>();
  for (const line of lines) {
    if (!line.category || !stack.categories.includes(line.category)) continue;
    const q = Math.floor(Number(line.quantity));
    if (!Number.isFinite(q) || q < 1) continue;
    qtyByCategory.set(
      line.category,
      (qtyByCategory.get(line.category) ?? 0) + q,
    );
  }
  return stack.categories.every((c) => (qtyByCategory.get(c) ?? 0) >= 1);
}
