/**
 * Presets and helpers for the admin campaign link builder.
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

export function buildCampaignUrl(i: {
  origin: string;
  path: string;
  source: string;
  medium: string;
  campaign: string;
  content?: string | null;
}): string {
  const path = i.path.startsWith("/") ? i.path : `/${i.path}`;
  const url = new URL(path, i.origin);
  url.searchParams.set("utm_source", i.source);
  url.searchParams.set("utm_medium", i.medium);
  url.searchParams.set("utm_campaign", i.campaign);
  if (i.content) url.searchParams.set("utm_content", i.content);
  return url.toString();
}
