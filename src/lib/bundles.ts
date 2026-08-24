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
 *   - a ZAR discount        — resolveBundleDiscount(). Slug bundles (the
 *     Everyday Edit's R175 per set) AND the category/mix stacks, which take
 *     10% off the qualifying lines. Whichever saves the most wins; they never
 *     compound on each other.
 *   - a shipping perk       — resolveShippingPerk(). Slug bundles only: the
 *     Everyday Edit adds free delivery on any method on top of its ZAR
 *     discount. The stacks award money off, not shipping.
 * Because a stack is a discount again, it suppresses typed discount codes the
 * same way the Everyday Edit does — one automatic discount, no code on top.
 *
 * This module is pure (no server/browser imports) so the SAME function runs in
 * CheckoutClient (to show the price) and in /api/checkout (the authority that
 * actually charges it). They can never diverge.
 */

import type { ShippingPerk } from "./shipping";
import {
  DAILY_AFFAIR_PIECES,
  DAILY_AFFAIR_SAVINGS,
} from "./daily-affair";

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

/**
 * The Daily Affair — the evening edit's five gold pieces.
 *
 * itemSlugs is DERIVED from DAILY_AFFAIR_PIECES rather than re-typed, so the
 * bundle and the collection page can't drift apart the way the Everyday Edit's
 * two hand-maintained lists can.
 *
 * INERT UNTIL SEEDED: none of these slugs exist in the catalogue yet (run
 * scripts/seed-daily-affair.mjs to create them). completeSets() therefore
 * returns 0 for every real cart and this bundle can never fire — it's safe to
 * ship ahead of the products, and it starts working the moment they exist.
 * bundles.test.ts pins that behaviour in both directions.
 */
export const DAILY_AFFAIR_BUNDLE: BundleDefinition = {
  code: "DAILY-AFFAIR",
  label: "The Daily Affair bundle",
  itemSlugs: DAILY_AFFAIR_PIECES.map((p) => p.slug),
  discountPerSet: DAILY_AFFAIR_SAVINGS,
  shippingPerk: "all_methods",
};

export const BUNDLES: BundleDefinition[] = [
  EVERYDAY_EDIT_BUNDLE,
  DAILY_AFFAIR_BUNDLE,
];

/**
 * A category "stack & save" — a percentage off, earned once the cart holds at
 * least `minQuantity` pieces from a given category. Like a slug bundle it is
 * cart-aware and automatic; unlike one the saving is a share of the qualifying
 * category subtotal rather than a fixed ZAR figure.
 */
export interface CategoryStackDefinition {
  /** Stored on the order's discount_code column for records/reporting. */
  code: string;
  /** Customer-facing label shown in the cart/checkout summary. */
  label: string;
  /** Category slug every qualifying line must match (e.g. "rings"). */
  category: string;
  /** Minimum total quantity in the category to unlock the discount. */
  minQuantity: number;
  /** Percentage off the qualifying category subtotal (0–100). */
  percentOff: number;
}

/**
 * Stack & Save: any 3 rings → 10% off the rings. The 10% is taken off the ring
 * subtotal only (never the whole cart), and unlocks once the cart holds 3+
 * rings. Keep the /shop rings banner copy driven off this config so the promo
 * shown and the discount charged can never drift.
 */
export const RINGS_STACK: CategoryStackDefinition = {
  code: "RINGS-STACK",
  label: "Stack & Save · rings",
  category: "rings",
  minQuantity: 3,
  percentOff: 10,
};

export const CATEGORY_STACKS: CategoryStackDefinition[] = [RINGS_STACK];

/**
 * A cross-category "mix & match stack" — one piece from each of several
 * categories unlocks a percentage off. The sibling of CategoryStackDefinition
 * (one category, quantity threshold): here the threshold is *breadth*, not
 * depth — the cart must hold at least one piece from every listed category.
 * Like the rings stack, once unlocked the percentage comes off the subtotal of
 * ALL lines in the listed categories, not just one trio.
 */
export interface MixStackDefinition {
  /** Stored on the order's discount_code column for records/reporting. */
  code: string;
  /** Customer-facing label shown in the cart/checkout summary. */
  label: string;
  /** Category slugs — the cart needs at least one piece from each. */
  categories: string[];
  /** Percentage off the combined listed-category subtotal (0–100). */
  percentOff: number;
}

/**
 * Create Your Own Stack: a necklace + earrings + a bracelet → 10% off those
 * pieces, automatically at checkout. Keep the PDP StackBuilder copy driven off
 * this config so the promo shown and the discount charged can never drift.
 */
export const MIX_MATCH_STACK: MixStackDefinition = {
  code: "MIX-STACK",
  label: "Create Your Own Stack",
  categories: ["necklaces", "earrings", "bracelets"],
  percentOff: 10,
};

export const MIX_STACKS: MixStackDefinition[] = [MIX_MATCH_STACK];

export interface BundleLine {
  slug: string | null | undefined;
  /** Category slug of the line's product — required for category stacks. */
  category?: string | null;
  /** Unit price (ZAR) — required to price percentage-based stacks. */
  price?: number | null;
  quantity: number;
}

export interface ResolvedBundle {
  code: string;
  label: string;
  /** Total ZAR discount (discountPerSet × complete sets, or percentOff of the
   *  qualifying subtotal for a stack). */
  amount: number;
  /** Number of complete sets of the bundle/stack found in the cart. */
  sets: number;
}

export interface ResolvedShippingPerk {
  /** Code of the bundle that earned the perk (for UI/analytics). */
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

/** A line's contribution to a subtotal, or 0 if its price/quantity is junk. */
function lineSubtotal(line: BundleLine): number {
  const qty = Math.floor(Number(line.quantity));
  if (!Number.isFinite(qty) || qty < 1) return 0;
  const price = Number(line.price);
  if (!Number.isFinite(price) || price <= 0) return 0;
  return price * qty;
}

/**
 * Resolve the best applicable cart-aware discount, or null if none applies.
 * Considers slug bundles (fixed ZAR per complete set, e.g. the Everyday Edit),
 * category stacks (a percentage off a category subtotal, e.g. the rings Stack
 * & Save) and mix stacks, and returns whichever saves the most — they never
 * stack on each other, mirroring the "one automatic discount, no code on top"
 * rule. The amount is NOT yet capped to the subtotal; the caller should
 * Math.min it against the subtotal.
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

  const stack = resolveCategoryStack(lines);
  if (stack && (!best || stack.amount > best.amount)) best = stack;

  const mix = resolveMixStack(lines);
  if (mix && (!best || mix.amount > best.amount)) best = mix;

  return best;
}

/**
 * Best applicable category stack, or null. For each stack, tallies the quantity
 * and subtotal of lines in its category; once the quantity clears minQuantity,
 * the discount is percentOff of that category subtotal (all qualifying lines,
 * not just the first minQuantity). `sets` reports how many minQuantity groups
 * are present, for reporting parity with slug bundles.
 */
function resolveCategoryStack(lines: BundleLine[]): ResolvedBundle | null {
  let best: ResolvedBundle | null = null;
  for (const stack of CATEGORY_STACKS) {
    let qty = 0;
    let subtotal = 0;
    for (const line of lines) {
      if (line.category !== stack.category) continue;
      const q = Math.floor(Number(line.quantity));
      if (!Number.isFinite(q) || q < 1) continue;
      qty += q;
      subtotal += lineSubtotal(line);
    }
    if (qty < stack.minQuantity || subtotal <= 0) continue;

    const amount = Number(((subtotal * stack.percentOff) / 100).toFixed(2));
    if (amount <= 0) continue;
    if (!best || amount > best.amount) {
      best = {
        code: stack.code,
        label: stack.label,
        amount,
        sets: Math.floor(qty / stack.minQuantity),
      };
    }
  }
  return best;
}

/**
 * Best applicable mix & match stack, or null. Tallies quantity + subtotal per
 * listed category; the stack unlocks only when every category holds at least
 * one piece, and then discounts percentOff of the combined listed-category
 * subtotal (all qualifying lines — the rings-stack rule applied across
 * categories). `sets` is the scarcest category's quantity, i.e. how many
 * complete trios the cart could assemble.
 */
function resolveMixStack(lines: BundleLine[]): ResolvedBundle | null {
  let best: ResolvedBundle | null = null;
  for (const stack of MIX_STACKS) {
    const qtyByCategory = new Map<string, number>();
    let subtotal = 0;
    for (const line of lines) {
      if (!line.category || !stack.categories.includes(line.category)) continue;
      const q = Math.floor(Number(line.quantity));
      if (!Number.isFinite(q) || q < 1) continue;
      qtyByCategory.set(
        line.category,
        (qtyByCategory.get(line.category) ?? 0) + q,
      );
      subtotal += lineSubtotal(line);
    }

    let sets = Infinity;
    for (const category of stack.categories) {
      sets = Math.min(sets, qtyByCategory.get(category) ?? 0);
    }
    if (!Number.isFinite(sets) || sets < 1 || subtotal <= 0) continue;

    const amount = Number(((subtotal * stack.percentOff) / 100).toFixed(2));
    if (amount <= 0) continue;
    if (!best || amount > best.amount) {
      best = { code: stack.code, label: stack.label, amount, sets };
    }
  }
  return best;
}

/**
 * Resolve the cart-earned shipping perk, or null if none applies. Only slug
 * bundles grant one — the Everyday Edit's free delivery on any method, on top
 * of its ZAR discount. The category/mix stacks pay out as money off instead
 * (see resolveBundleDiscount), so they never appear here.
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

  if (candidates.length === 0) return null;
  return candidates.find((c) => c.perk === "all_methods") ?? candidates[0];
}
