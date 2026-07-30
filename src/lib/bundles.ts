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
    // The edit's earring piece is Sia (see EDIT in collections/everyday/page.tsx).
    // These slugs MUST match that list exactly or the bundle never completes and
    // no discount reaches checkout — keep the two in sync.
    "sia-earrings-gold",
    "sole-rings-gold",
    "mila-bracelets-gold",
  ],
  discountPerSet: 175,
};

export const BUNDLES: BundleDefinition[] = [EVERYDAY_EDIT_BUNDLE];

/**
 * A category "stack & save" — a percentage off the qualifying line items once
 * the cart holds at least `minQuantity` pieces from a given category. Unlike a
 * slug bundle (fixed ZAR per set) it is priced as a percentage of the
 * qualifying subtotal, so the resolver needs each line's category + price. Like
 * a bundle it is cart-aware, automatic, and can't be stacked onto a typed code.
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
 * Stack & Save: any 3 rings → 15% off the rings. The 15% is taken off the ring
 * subtotal only (never the whole cart), and unlocks once the cart holds 3+
 * rings. Keep the /shop rings banner copy driven off this config so the promo
 * shown and the discount charged can never drift.
 */
export const RINGS_STACK: CategoryStackDefinition = {
  code: "RINGS-STACK",
  label: "Stack & Save · rings",
  category: "rings",
  minQuantity: 3,
  percentOff: 15,
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
 * Create Your Own Stack: a necklace + earrings + a bracelet → 15% off those
 * pieces, automatically at checkout. Keep the PDP StackBuilder copy driven off
 * this config so the promo shown and the discount charged can never drift.
 */
export const MIX_MATCH_STACK: MixStackDefinition = {
  code: "MIX-STACK",
  label: "Create Your Own Stack",
  categories: ["necklaces", "earrings", "bracelets"],
  percentOff: 15,
};

export const MIX_STACKS: MixStackDefinition[] = [MIX_MATCH_STACK];

export interface BundleLine {
  slug: string | null | undefined;
  /** Category slug of the line's product — required for category stacks. */
  category?: string | null;
  /** Unit price (ZAR) — required to price percentage-based category stacks. */
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

/**
 * Resolve the best applicable cart-aware discount, or null if none applies.
 * Considers both slug bundles (fixed ZAR per complete set, e.g. the Everyday
 * Edit) and category stacks (a percentage off a category subtotal, e.g. the
 * rings Stack & Save) and returns whichever saves the most — they never stack
 * on each other, mirroring the "one automatic discount, no code on top" rule.
 * The amount is NOT yet capped to the subtotal; the caller should Math.min it
 * against the subtotal.
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
      const price = Number(line.price);
      if (Number.isFinite(price) && price > 0) subtotal += price * q;
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
      const price = Number(line.price);
      if (Number.isFinite(price) && price > 0) subtotal += price * q;
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
