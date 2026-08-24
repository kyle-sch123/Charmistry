/**
 * Create The Daily Affair's catalogue rows.
 *
 * The ten rows were created on 2026-08-24 (via the Supabase MCP server, stock
 * 2 across the board). This script is the reproducible record of that state:
 * run it to recreate the collection in a fresh environment, or to reset the
 * rows back to their launch copy after editing them by hand.
 *
 * Its other job is structural: bundles.test.ts imports SEED_ROWS and fails if
 * these slugs, prices or categories ever drift from DAILY_AFFAIR_PIECES.
 *
 *   node scripts/seed-daily-affair.mjs                        # dry run
 *   node scripts/seed-daily-affair.mjs --apply                # content only
 *   node scripts/seed-daily-affair.mjs --apply --restore-state # + launch stock & hidden
 *   node scripts/seed-daily-affair.mjs --apply --stock 4       # + uniform stock
 *
 * DRY RUN BY DEFAULT, on purpose: this writes to the production catalogue, and
 * /shop lists out-of-stock products, so the moment these rows exist ten new
 * pieces appear on the live shop grid whether or not the collection has
 * launched. Run it when you're ready for that.
 *
 * Idempotent — upserts on `slug`, so re-running updates rather than duplicates.
 * Stock is only ever written when you pass --stock; a re-run without it leaves
 * whatever quantities you've since set in /admin/catalogue alone.
 *
 * SLUGS AND PRICES ARE LOAD-BEARING: they must match DAILY_AFFAIR_PIECES in
 * src/lib/daily-affair.ts, or the bundle silently never applies. That's not
 * left to discipline — bundles.test.ts imports SEED_ROWS from this file and
 * fails if the two drift.
 */

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const ASSETS =
  "https://qkgakhluqruqoifknprg.supabase.co/storage/v1/object/public/Charmistry%20Assets/daily-affair";

const img = (stem) => `${ASSETS}/${stem}.webp`;

const MATERIAL = "Stainless steel";

/** These launched as a new collection; keep a re-run reproducing that. */
const BADGE = "NEW";

/**
 * Early access: the collection is password-gated and its pieces are kept off
 * /shop, search and every other browse surface (products.shop_hidden,
 * migration 011). Their product PAGES still resolve, which is what lets the
 * gated collection page link to them and sell them.
 */
const SHOP_HIDDEN = true;

/** Sentinel the PDP renders as "Adjustable" (see lib/utils.isAdjustableSize). */
const ADJUSTABLE = 0;

/**
 * The ten rows: the five gold pieces of the edit, then the silver half of the
 * collection. Astra is gold-only and Lune silver-only — that mirrors the
 * photography, not an oversight.
 *
 * `shop_featured` marks the variant that represents the piece on /shop (see
 * lib/pieces.ts); gold wins, matching how the collection is styled.
 */
export const SEED_ROWS = [
  // ── the edit, in gold ──
  {
    name: "Lumi Necklace",
    slug: "lumi-necklaces-gold",
    quantity: 4,
    category: "necklaces",
    metal: "gold",
    price: 189,
    size: ADJUSTABLE,
    shop_featured: true,
    description:
      "A single round stone on a chain fine enough to disappear against the skin. Sits high on the collarbone, which is what makes it layer so well under anything longer. Waterproof and tarnish-resistant, like everything else we make.",
    image: "lumi-necklace-gold",
    images: ["lumi-necklace-gold", "isa-lumi-necklaces-worn"],
  },
  {
    name: "Isa Necklace",
    slug: "isa-necklaces-gold",
    quantity: 4,
    category: "necklaces",
    metal: "gold",
    price: 189,
    size: ADJUSTABLE,
    shop_featured: true,
    description:
      "Flat, faceted mariner links that catch light the way a round chain never does. Finished with a lobster clasp and an extender so it sits where you want it. Wear it alone, or over the Lumi for the layer it was designed around.",
    image: "isa-necklace-gold",
    images: [
      "isa-necklace-gold",
      "daily-affair-campaign-01",
      "isa-lumi-necklaces-worn",
    ],
  },
  {
    name: "Astra Ring",
    slug: "astra-rings-gold",
    quantity: 7,
    category: "rings",
    metal: "gold",
    price: 159,
    size: null,
    shop_featured: true,
    description:
      "A marquise-cut stone set close to a slim band, enough to catch the room without catching on anything. The piece that does the most work in a photograph and still sits flat enough to hold a glass properly.",
    image: "astra-ring-gold",
    images: [
      "astra-ring-gold",
      "astra-ring-gold-worn",
      "astra-ring-gold-worn-2",
      "astra-ring-gold-worn-3",
    ],
  },
  {
    name: "Aria Bracelet",
    slug: "aria-bracelets-gold",
    quantity: 5,
    category: "bracelets",
    metal: "gold",
    price: 179,
    size: ADJUSTABLE,
    shop_featured: true,
    description:
      "An unbroken line of stones on a slider chain, so it draws in to your wrist and stays where you put it. No clasp to fight with in bad light. The closest thing in the collection to a tennis bracelet.",
    image: "aria-bracelet-gold",
    images: [
      "aria-bracelet-gold",
      "aria-isa-bracelets-worn",
      "daily-affair-campaign-03",
    ],
  },
  {
    name: "Isa Bracelet",
    slug: "isa-bracelets-gold",
    quantity: 4,
    category: "bracelets",
    metal: "gold",
    price: 179,
    size: ADJUSTABLE,
    shop_featured: true,
    description:
      "The Isa chain, cut for a wrist. Flat faceted links with a lobster clasp and an extender. Stack it against the Aria and the flat links break up all that sparkle before it tips into too much.",
    image: "isa-bracelet-gold",
    images: [
      "isa-bracelet-gold",
      "aria-isa-bracelets-worn",
      "daily-affair-campaign-03",
    ],
  },

  // ── the same night, in silver ──
  {
    name: "Lune Ring",
    slug: "lune-rings-silver",
    quantity: 5,
    category: "rings",
    metal: "silver",
    price: 159,
    size: null,
    shop_featured: true,
    description:
      "A twisted band set with a line of small stones that follows the turn of the metal. Silver only, and the one piece in The Daily Affair with no gold twin, so wear it where the Astra would go.",
    image: "lune-ring-silver",
    images: ["lune-ring-silver", "lune-ring-silver-worn"],
  },
  {
    name: "Lumi Necklace",
    slug: "lumi-necklaces-silver",
    quantity: 3,
    category: "necklaces",
    metal: "silver",
    price: 189,
    size: ADJUSTABLE,
    shop_featured: false,
    description:
      "A single round stone on a chain fine enough to disappear against the skin. Sits high on the collarbone, which is what makes it layer so well under anything longer. Waterproof and tarnish-resistant, like everything else we make.",
    image: "lumi-necklace-silver",
    images: ["lumi-necklace-silver"],
  },
  {
    name: "Isa Necklace",
    slug: "isa-necklaces-silver",
    quantity: 3,
    category: "necklaces",
    metal: "silver",
    price: 189,
    size: ADJUSTABLE,
    shop_featured: false,
    description:
      "Flat, faceted mariner links that catch light the way a round chain never does. Finished with a lobster clasp and an extender so it sits where you want it. Wear it alone, or over the Lumi for the layer it was designed around.",
    image: "isa-necklace-silver",
    images: ["isa-necklace-silver"],
  },
  {
    name: "Aria Bracelet",
    slug: "aria-bracelets-silver",
    quantity: 6,
    category: "bracelets",
    metal: "silver",
    price: 179,
    size: ADJUSTABLE,
    shop_featured: false,
    description:
      "An unbroken line of stones on a slider chain, so it draws in to your wrist and stays where you put it. No clasp to fight with in bad light. The closest thing in the collection to a tennis bracelet.",
    image: "aria-bracelet-silver",
    images: ["aria-bracelet-silver"],
  },
  {
    name: "Isa Bracelet",
    slug: "isa-bracelets-silver",
    quantity: 3,
    category: "bracelets",
    metal: "silver",
    price: 179,
    size: ADJUSTABLE,
    shop_featured: false,
    description:
      "The Isa chain, cut for a wrist. Flat faceted links with a lobster clasp and an extender. Stack it against the Aria and the flat links break up all that sparkle before it tips into too much.",
    image: "isa-bracelet-silver",
    images: ["isa-bracelet-silver"],
  },
];

async function loadEnv() {
  const raw = await readFile(new URL("../.env", import.meta.url), "utf8");
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [
          l.slice(0, i).trim(),
          l.slice(i + 1).trim().replace(/^["']|["']$/g, ""),
        ];
      }),
  );
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const stockIdx = args.indexOf("--stock");
  const stock = stockIdx >= 0 ? Number(args[stockIdx + 1]) : null;
  const restoreState = args.includes("--restore-state");

  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
    console.error("--stock must be a non-negative integer");
    process.exit(1);
  }

  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: cats, error: catErr } = await sb
    .from("categories")
    .select("id, slug");
  if (catErr) throw catErr;
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  const { data: existing, error: exErr } = await sb
    .from("products")
    .select("slug")
    .in(
      "slug",
      SEED_ROWS.map((r) => r.slug),
    );
  if (exErr) throw exErr;
  const already = new Set((existing ?? []).map((r) => r.slug));

  const rows = SEED_ROWS.map((r) => {
    const category_id = catId.get(r.category);
    if (!category_id) throw new Error(`Unknown category: ${r.category}`);
    return {
      name: r.name,
      slug: r.slug,
      description: r.description,
      price: r.price,
      category_id,
      metal: r.metal,
      badge: BADGE,
      material: MATERIAL,
      size: r.size,
      image_url: img(r.image),
      images: r.images.map(img),
      shop_featured: r.shop_featured,
      // CONTENT above is always written. OPERATIONAL STATE (stock, shop
      // visibility) is only written when explicitly asked, so a routine re-run
      // can never silently un-sell or re-hide something changed since launch.
      ...(stock !== null
        ? { quantity: stock, in_stock: stock > 0 }
        : restoreState
          ? {
              quantity: r.quantity,
              in_stock: r.quantity > 0,
              shop_hidden: SHOP_HIDDEN,
            }
          : {}),
    };
  });

  console.log(
    `\n${apply ? "APPLYING" : "DRY RUN"} — ${rows.length} rows` +
      (stock !== null
        ? ` (stock ${stock} on every row, in_stock ${stock > 0})`
        : restoreState
          ? " (restoring recorded launch stock + shop_hidden)"
          : " (content only; stock and shop visibility untouched)") +
      "\n",
  );
  for (const r of SEED_ROWS) {
    console.log(
      `  ${already.has(r.slug) ? "update" : "create"}  ${r.slug.padEnd(24)} ` +
        `${r.name.padEnd(16)} R${r.price}  qty ${String(r.quantity).padEnd(2)} ${r.images.length} image(s)`,
    );
  }

  if (!apply) {
    console.log("\nNothing written. Re-run with --apply to create these rows.\n");
    return;
  }

  const { error } = await sb
    .from("products")
    .upsert(rows, { onConflict: "slug" });
  if (error) throw error;

  console.log(`\nDone — ${rows.length} rows upserted.`);
  console.log("Next: set stock in /admin/catalogue, then flip DAILY_AFFAIR_LIVE");
  console.log("in src/lib/daily-affair.ts to launch the collection.\n");
}

// Only run when invoked directly — bundles.test.ts imports SEED_ROWS.
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await main();
}
