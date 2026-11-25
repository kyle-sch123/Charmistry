/**
 * The small normalisation helpers the browser tracker needs, split out of the
 * classifier so the storefront bundle never carries the full source lists.
 *
 * Why separate: channel.ts holds hundreds of source names and Google's rules,
 * which only the server and the admin link builder need. The tracker only has
 * to tidy tag values, spot in-app browsers and ignore our own site and
 * PayFast as referrers. channel.ts re-exports these, so both share one copy.
 */

import type { InAppPlatform } from "./types";

export const PAYFAST_HOSTS: readonly string[] = [
  "payfast.co.za",
  "www.payfast.co.za",
  "sandbox.payfast.co.za",
];

const SOURCE_ALIASES: Record<string, string> = {
  fb: "facebook",
  ig: "instagram",
  msg: "messenger",
  an: "audience_network",
};

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/**
 * Normalise one UTM value. `URLSearchParams` has already decoded it once, so
 * it is never decoded again: strip control characters, trim, collapse
 * whitespace to "-", lowercase, cap at 100 characters. Empty becomes null.
 */
export function normaliseUtm(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const v = raw
    .replace(CONTROL_CHARS, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 100);
  return v.length > 0 ? v : null;
}

/** `normaliseUtm`, then Meta's short `site_source_name` values become names. */
export function normaliseSource(raw: string | null | undefined): string | null {
  const v = normaliseUtm(raw);
  if (v === null) return null;
  return SOURCE_ALIASES[v] ?? v;
}

export function stripWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

/** In-app browsers often send no referrer; their user agent still says which app. */
export function detectInApp(
  userAgent: string | null | undefined,
): InAppPlatform | null {
  if (!userAgent) return null;
  if (/Instagram/.test(userAgent)) return "instagram";
  if (/FBAN|FBAV/.test(userAgent)) return "facebook";
  if (/TikTok|musical_ly|Bytedance/i.test(userAgent)) return "tiktok";
  return null;
}

/** Our own site (and its subdomains) and PayFast's return trip are never a source. */
export function isIgnoredReferrer(host: string, ownHost: string): boolean {
  const h = stripWww(host.trim().toLowerCase());
  const own = stripWww(ownHost.trim().toLowerCase());
  if (!h) return true;
  if (own && (h === own || h.endsWith(`.${own}`))) return true;
  return PAYFAST_HOSTS.includes(h) || PAYFAST_HOSTS.includes(`www.${h}`);
}
