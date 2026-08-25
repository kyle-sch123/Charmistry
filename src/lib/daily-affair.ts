/**
 * The Daily Affair — the edit's single source of truth.
 *
 * Everything about the collection that more than one surface needs to agree on
 * lives here: the launch flag, the five pieces (in the order the page tells the
 * evening), the campaign photography, and the srcset ladder that serves it.
 *
 * WHY a lib module rather than the page file: three surfaces read this — the
 * collection page, the /collections index card, and lib/bundles.ts (which
 * derives the bundle's itemSlugs from PIECES rather than re-typing them). The
 * Everyday Edit keeps its slugs in two places with a "keep these in sync"
 * comment; deriving them removes that whole class of bug here.
 *
 * Dependency-free on purpose — bundles.ts imports it, so it must not import
 * bundles.ts back.
 *
 * ── STATUS ────────────────────────────────────────────────────────────────
 * The five pieces are NOT in the catalogue yet. `scripts/seed-daily-affair.mjs`
 * creates them from PIECES; until it's run, getProductBySlug returns null for
 * every slug and the page renders from the static copy below with its buy
 * actions disabled (see page.tsx). Prices here are the catalogue's uniform
 * category bands (necklaces R189 · rings R159 · bracelets R179) and are used
 * for display only — a resolved product row always wins.
 */

/**
 * Launch switch. One constant drives the route, the /collections card and the
 * Collections nav entry.
 *
 *   true  — public and indexable: the route renders, the card links to it
 *           and the Collections nav carries the entry.
 *   false — off the site entirely: the route 404s and nothing links to it.
 *
 * There used to be a third state between those two: an early-access "preview"
 * that linked to a password door and kept the page noindex. That window has
 * closed, so the door and its secret are gone and the collection is simply
 * open.
 *
 * Annotated `: boolean` rather than left to inference: TypeScript narrows a
 * `const` to its literal initializer, which would make every
 * `!DAILY_AFFAIR_LIVE` check read as provably dead code and reject the flag
 * ever being turned back off.
 */
export const DAILY_AFFAIR_LIVE: boolean = true;

const ASSETS =
  "https://qkgakhluqruqoifknprg.supabase.co/storage/v1/object/public/Charmistry%20Assets/daily-affair";

/**
 * Widths pre-rendered for every asset (see the responsive variants in the
 * bucket: `<stem>-640.webp` etc.). next.config sets `unoptimized: true` because
 * Cloudflare doesn't run Next's image optimizer, which means <Image> emits a
 * single full-size src with no srcset — a 2400px hero on a 375px phone. So the
 * ladder is baked at upload time and served through a plain <img srcSet>.
 */
const LADDER = [640, 960, 1280, 2000] as const;

export interface AffairAsset {
  /** File stem in the daily-affair/ bucket folder, without extension. */
  stem: string;
  /** Intrinsic size of the full-size file — set on the <img> to reserve space. */
  w: number;
  h: number;
  alt: string;
}

/** Campaign + product photography, keyed by the name used in the page. */
export const IMG = {
  // ── editorial / campaign ──
  campaignWide: {
    stem: "daily-affair-campaign-02",
    w: 1800,
    h: 2400,
    alt: "A woman in a black tee holding a martini, wearing layered gold Charmistry necklaces",
  },
  campaignTall: {
    stem: "daily-affair-campaign-04",
    w: 1206,
    h: 2097,
    alt: "A woman resting a hand against her face, the Astra ring and Aria bracelet catching the light",
  },
  campaignSeated: {
    stem: "daily-affair-campaign-01",
    w: 1800,
    h: 2400,
    alt: "Seated at a bar table in a black tee, the Isa and Lumi necklaces layered at the collarbone",
  },
  campaignHands: {
    stem: "daily-affair-campaign-03",
    w: 1206,
    h: 1921,
    alt: "A hand around a martini stem wearing the Astra ring, with gold bracelets stacked at the wrist",
  },
  necklacesWorn: {
    stem: "isa-lumi-necklaces-worn",
    w: 1204,
    h: 1804,
    alt: "The Isa chain and the Lumi solitaire pendant worn layered at the collarbone",
  },
  ringWorn: {
    stem: "astra-ring-gold-worn",
    w: 1800,
    h: 2400,
    alt: "The Astra gold marquise ring on a hand resting around a martini glass",
  },
  braceletsWorn: {
    stem: "aria-isa-bracelets-worn",
    w: 1800,
    h: 2400,
    alt: "The Aria stone bracelet and the Isa chain bracelet stacked on a wrist",
  },
  luneWorn: {
    stem: "lune-ring-silver-worn",
    w: 1800,
    h: 2400,
    alt: "The Lune silver twisted pavé ring worn on a hand holding a martini glass",
  },
  /** Two hands around a glass. Used for the editorial break so the mid-page
   *  image isn't a repeat of the mobile hero (campaignTall). */
  tableWorn: {
    stem: "astra-ring-gold-worn-2",
    w: 913,
    h: 1326,
    alt: "Two hands around a martini glass at a low table, the Astra gold ring on one finger",
  },

  // ── product cut-outs ──
  lumiGold: {
    stem: "lumi-necklace-gold",
    w: 2400,
    h: 2400,
    alt: "The Lumi gold necklace — a single round stone on a fine chain",
  },
  isaNecklaceGold: {
    stem: "isa-necklace-gold",
    w: 2066,
    h: 2066,
    alt: "The Isa gold necklace — a flat faceted mariner chain",
  },
  astraGold: {
    stem: "astra-ring-gold",
    w: 2400,
    h: 2400,
    alt: "The Astra gold ring — a marquise-cut stone on a slim band",
  },
  ariaGold: {
    stem: "aria-bracelet-gold",
    w: 2400,
    h: 2400,
    alt: "The Aria gold bracelet — a continuous line of stones on an adjustable slider chain",
  },
  isaBraceletGold: {
    stem: "isa-bracelet-gold",
    w: 2400,
    h: 2400,
    alt: "The Isa gold bracelet — a flat faceted mariner chain with an extender",
  },

  // ── the same pieces, in silver ──
  lumiSilver: {
    stem: "lumi-necklace-silver",
    w: 2400,
    h: 2400,
    alt: "The Lumi silver necklace — a single round stone on a fine chain",
  },
  isaNecklaceSilver: {
    stem: "isa-necklace-silver",
    w: 2400,
    h: 2400,
    alt: "The Isa silver necklace — a flat faceted mariner chain",
  },
  ariaSilver: {
    stem: "aria-bracelet-silver",
    w: 2400,
    h: 2400,
    alt: "The Aria silver bracelet — a continuous line of stones on an adjustable slider chain",
  },
  isaBraceletSilver: {
    stem: "isa-bracelet-silver",
    w: 2400,
    h: 2400,
    alt: "The Isa silver bracelet — a flat faceted mariner chain with an extender",
  },
  luneSilver: {
    stem: "lune-ring-silver",
    w: 2400,
    h: 2400,
    alt: "The Lune silver ring — a twisted band set with a line of small stones",
  },
} as const satisfies Record<string, AffairAsset>;

/** Full-size file — the top rung, and the only one guaranteed to exist. */
export function affairSrc(asset: AffairAsset): string {
  return `${ASSETS}/${asset.stem}.webp`;
}

/**
 * srcset across every pre-rendered rung that isn't an upscale, plus the
 * full-size file. Variants are only generated up to the source width, so
 * filtering by `asset.w` here mirrors exactly what's in the bucket.
 */
export function affairSrcSet(asset: AffairAsset): string {
  const rungs = LADDER.filter((w) => w < asset.w).map(
    (w) => `${ASSETS}/${asset.stem}-${w}.webp ${w}w`,
  );
  rungs.push(`${affairSrc(asset)} ${asset.w}w`);
  return rungs.join(", ");
}

/**
 * The `src` fallback, and the URL used for the OpenGraph card. Prefers the
 * 1280 rung — a sane middle rather than the 2400px original — and falls back
 * to the largest rung the asset actually has.
 */
export function affairFallbackSrc(asset: AffairAsset): string {
  const available = LADDER.filter((w) => w < asset.w);
  const rung = available.includes(1280) ? 1280 : available.at(-1);
  return rung ? `${ASSETS}/${asset.stem}-${rung}.webp` : affairSrc(asset);
}

export interface AffairPiece {
  /** Catalogue slug — gold variant, matching the campaign styling. */
  slug: string;
  /** Clock position on the rail. Narrative, not a delivery promise. */
  hour: string;
  /** The moment the hour stands for. */
  moment: string;
  name: string;
  /** One-word role used in the bundle strip. */
  short: string;
  copy: string;
  /** Only what the photography actually shows, plus the brand's own material
   *  claim. Nothing here asserts a length, gauge or plating spec we haven't
   *  published — the template's "316L · 18K PVD" was invented. */
  specs: string[];
  /** Catalogue band price. Display-only fallback; a real row overrides it. */
  price: number;
  /** Category slug the seed script files the piece under. */
  category: "necklaces" | "rings" | "bracelets";
  /** Editorial shot for the stage + the mobile card. */
  stage: AffairAsset;
  /** Clean cut-out for the bundle strip. NOT called `product` — RailPiece
   *  adds a `product` field for the resolved catalogue row. */
  cutout: AffairAsset;
}

export const DAILY_AFFAIR_PIECES: readonly AffairPiece[] = [
  {
    slug: "lumi-necklaces-gold",
    hour: "18:00",
    moment: "The first one poured",
    name: "Lumi Necklace",
    short: "Lumi",
    copy: "A single stone on a chain fine enough to disappear. It does the one thing an evening piece has to do — catch the light when you turn your head.",
    specs: ["Solitaire pendant", "Fine cable chain", "Stainless steel"],
    price: 189,
    category: "necklaces",
    stage: IMG.necklacesWorn,
    cutout: IMG.lumiGold,
  },
  {
    slug: "isa-necklaces-gold",
    hour: "19:15",
    moment: "Table for two, at the back",
    name: "Isa Necklace",
    short: "Isa",
    copy: "Flat, faceted links that throw light the way a round chain never does. Worn over the Lumi, the two stop looking like two necklaces and start looking deliberate.",
    specs: ["Flat mariner links", "Clasp + extender", "Stainless steel"],
    price: 189,
    category: "necklaces",
    stage: IMG.campaignSeated,
    cutout: IMG.isaNecklaceGold,
  },
  {
    slug: "astra-rings-gold",
    hour: "20:30",
    moment: "Hand around the stem",
    name: "Astra Ring",
    short: "Astra",
    copy: "A marquise stone set close to a slim band. It does the most work in every photo you'll take tonight and still sits flat enough to hold a glass properly.",
    specs: ["Marquise-cut stone", "Slim band", "Stainless steel"],
    price: 159,
    category: "rings",
    stage: IMG.ringWorn,
    cutout: IMG.astraGold,
  },
  {
    slug: "aria-bracelets-gold",
    hour: "21:45",
    moment: "One more, then",
    name: "Aria Bracelet",
    short: "Aria",
    copy: "An unbroken line of stones on a slider chain, so it draws in to your wrist and stays where you put it. No clasp to fight with in bad light.",
    specs: ["Continuous stone line", "Adjustable slider", "Stainless steel"],
    price: 179,
    category: "bracelets",
    stage: IMG.braceletsWorn,
    cutout: IMG.ariaGold,
  },
  {
    slug: "isa-bracelets-gold",
    hour: "23:00",
    moment: "Last call",
    name: "Isa Bracelet",
    short: "Isa",
    copy: "The necklace's chain, cut for a wrist. Stack it against the Aria and the flat links break up all that sparkle before it tips into too much.",
    specs: ["Flat mariner links", "Clasp + extender", "Stainless steel"],
    price: 179,
    category: "bracelets",
    stage: IMG.campaignHands,
    cutout: IMG.isaBraceletGold,
  },
];

/** What the edit saves when bought as one. Mirrors the Everyday Edit's R175 so
 *  the two collections read consistently on the /collections index. */
export const DAILY_AFFAIR_SAVINGS = 175;

/** Sum of the band prices — the display fallback before the rows exist. */
export const DAILY_AFFAIR_LIST_PRICE = DAILY_AFFAIR_PIECES.reduce(
  (sum, p) => sum + p.price,
  0,
);

/** The silver half of the collection. Not part of the five-piece edit — these
 *  are the same pieces in the other metal, shown so the page doesn't imply the
 *  collection is gold-only. Lune leads because it has no gold twin. */
export interface AffairSilverPiece {
  name: string;
  note: string;
  image: AffairAsset;
}

export const DAILY_AFFAIR_SILVER: readonly AffairSilverPiece[] = [
  { name: "Lune Ring", note: "Twisted band", image: IMG.luneSilver },
  { name: "Lumi Necklace", note: "Solitaire", image: IMG.lumiSilver },
  { name: "Isa Necklace", note: "Flat chain", image: IMG.isaNecklaceSilver },
  { name: "Aria Bracelet", note: "Stone line", image: IMG.ariaSilver },
  { name: "Isa Bracelet", note: "Flat chain", image: IMG.isaBraceletSilver },
];

/**
 * The room, 18:00 → 23:00. A warm black rather than the site's neutral ink —
 * the page is lit by one lamp over a bar, not by daylight. `late` is painted
 * over `early` by a fixed overlay whose *opacity* tracks scroll, because
 * opacity composites on the GPU and animating background-color does not.
 */
export const ROOM = {
  early: "#1E1814",
  late: "#0B0806",
  linen: "#EDE7DC",
  smoke: "#8C8177",
} as const;
