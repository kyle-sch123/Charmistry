/**
 * Presets and helpers for the admin campaign link builder, and the tags on
 * the links in the emails the shop sends itself.
 *
 * Why this exists: tagged links only group cleanly if every post, story and
 * email uses the same lowercase source and medium values. The builder offers
 * these presets (following the Charmistry UTM convention: `instagram / social`,
 * `klaviyo / email`, `insert / qr` ...) and a month-first campaign name, so the
 * owner never has to remember the spelling. Classification of the result is
 * left to `classify()` in channel.ts, the same rules the tracker uses.
 */

export interface Preset {
  value: string;
  label: string;
}

export const SOURCE_PRESETS: readonly Preset[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "pinterest", label: "Pinterest" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "klaviyo", label: "Klaviyo" },
  { value: "google", label: "Google" },
  { value: "insert", label: "Packaging insert" },
  { value: "other", label: "Other" },
];

export const MEDIUM_PRESETS: readonly Preset[] = [
  { value: "social", label: "Social" },
  { value: "paid_social", label: "Paid social" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "messaging", label: "Messaging" },
  { value: "cpc", label: "Paid search" },
  { value: "influencer", label: "Influencer" },
  { value: "qr", label: "QR code" },
];

const DEFAULT_MEDIUM: Record<string, string> = {
  insert: "qr",
  klaviyo: "email",
  whatsapp: "messaging",
  google: "cpc",
};

export function defaultMediumFor(source: string): string {
  return DEFAULT_MEDIUM[source] ?? "social";
}

/** Lowercase words joined by single hyphens or underscores. */
export const CAMPAIGN_RE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

/** Turn free text into a tag value: lowercase, spaces to "-", nothing else. */
export function slugifyTag(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/_{2,}/g, "_")
    .replace(/[-_]{2,}/g, (m) => m[0])
    .replace(/^[-_]+|[-_]+$/g, "");
}

/** SAST is UTC+2 all year (no daylight saving), so fixed-offset maths is exact. */
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

/** The current month in SAST as a campaign prefix, e.g. "2026-11_". */
export function campaignPrefix(now: Date): string {
  const sast = new Date(now.getTime() + SAST_OFFSET_MS);
  const y = sast.getUTCFullYear();
  const m = String(sast.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}_`;
}

export interface LinkTags {
  source: string;
  medium: string;
  campaign: string;
  content?: string | null;
}

function setTags(url: URL, tags: LinkTags): void {
  url.searchParams.set("utm_source", tags.source);
  url.searchParams.set("utm_medium", tags.medium);
  url.searchParams.set("utm_campaign", tags.campaign);
  if (tags.content) url.searchParams.set("utm_content", tags.content);
}

export function buildCampaignUrl(i: LinkTags & { origin: string; path: string }): string {
  const path = i.path.startsWith("/") ? i.path : `/${i.path}`;
  const url = new URL(path, i.origin);
  setTags(url, i);
  return url.toString();
}

/**
 * Tags for the links back to the shop in the emails it sends through Resend.
 * The order confirmation is `transactional`: the dashboard shows those visits
 * but never credits them with a sale, so a "Continue shopping" click can't
 * take the credit from the campaign that won the customer. The welcome email
 * carries the 10% code, so it is marketing and files under Email.
 */
export const SHOP_EMAIL_TAGS = {
  orderConfirmation: {
    source: "transactional",
    medium: "email",
    campaign: "order-confirmation",
    content: "continue-shopping_btn",
  },
  welcome: {
    source: "resend",
    medium: "email",
    campaign: "flow_welcome",
    content: "shop-now_btn",
  },
} as const satisfies Record<string, LinkTags>;

/**
 * Add campaign tags to an absolute link. Never throws: a malformed base comes
 * back unchanged, so a bad NEXT_PUBLIC_SITE_URL can never stop an order email
 * going out.
 */
export function tagLink(href: string, tags: LinkTags): string {
  try {
    const url = new URL(href);
    setTags(url, tags);
    return url.toString();
  } catch {
    return href;
  }
}
