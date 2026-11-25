/**
 * The one traffic-source classifier: turns campaign tags, click ids, the
 * referrer and (as a last resort) an in-app browser hint into a source,
 * medium and marketing channel.
 *
 * Why there is exactly one copy: the collect API classifies sessions with it,
 * the checkout snapshot classifies an order's touches with it, and the admin
 * link builder previews "Shows as" with it. If they disagreed, a link the
 * owner built would land in a different channel than the builder promised.
 *
 * Rules: Charmistry overlay rules first (O1..O6), then Google Analytics 4's
 * default channel group in the order Google's help page lists it, with "AI
 * assistant" before Referral. The two regular expressions are copied verbatim
 * from Google. Pure and dependency-free, so it is safe in the browser.
 */

import {
  detectInApp,
  isIgnoredReferrer,
  normaliseSource,
  normaliseUtm,
  PAYFAST_HOSTS,
  stripWww,
} from "./normalise";
import type { ClickIdType, InAppPlatform, Touch } from "./types";

export { detectInApp, isIgnoredReferrer, normaliseSource, normaliseUtm, PAYFAST_HOSTS };

export type Channel =
  | "Direct"
  | "Cross-network"
  | "Paid shopping"
  | "Paid search"
  | "Paid social"
  | "Paid video"
  | "Display"
  | "Paid other"
  | "Organic shopping"
  | "Organic social"
  | "Organic video"
  | "Organic search"
  | "AI assistant"
  | "Referral"
  | "Email"
  | "Affiliates"
  | "Audio"
  | "SMS"
  | "Mobile push"
  | "Influencer"
  | "QR codes"
  | "Messaging"
  | "Transactional"
  | "Unassigned";

export const CHANNELS: readonly Channel[] = [
  "Direct",
  "Cross-network",
  "Paid shopping",
  "Paid search",
  "Paid social",
  "Paid video",
  "Display",
  "Paid other",
  "Organic shopping",
  "Organic social",
  "Organic video",
  "Organic search",
  "AI assistant",
  "Referral",
  "Email",
  "Affiliates",
  "Audio",
  "SMS",
  "Mobile push",
  "Influencer",
  "QR codes",
  "Messaging",
  "Transactional",
  "Unassigned",
];

export interface ClassifyInput {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  clickIdType: ClickIdType | null;
  referrerHost: string | null;
  inApp: InAppPlatform | null;
}

export interface Classified {
  channel: Channel;
  source: string;
  medium: string;
  campaign: string | null;
  /** fbclid-only or in-app user-agent guess */
  inferred: boolean;
  /** Transactional only: shown, never attributed */
  excluded: boolean;
}

/** Google's verbatim patterns. */
export const PAID_MEDIUM = /^(.*cp.*|ppc|retargeting|paid.*)$/;
export const SHOP_CAMPAIGN = /^(.*(([^a-df-z]|^)shop|shopping).*)$/;

export const SOCIAL_SOURCES: ReadonlySet<string> = new Set([
  "facebook",
  "facebook.com",
  "fb",
  "fb.me",
  "m.facebook.com",
  "l.facebook.com",
  "lm.facebook.com",
  "web.facebook.com",
  "free.facebook.com",
  "mobile.facebook.com",
  "touch.facebook.com",
  "business.facebook.com",
  "instagram",
  "instagram.com",
  "ig",
  "l.instagram.com",
  "lm.instagram.com",
  "messenger",
  "messenger.com",
  "l.messenger.com",
  // Meta ads report `{{site_source_name}}=an` for Audience Network placements.
  "audience_network",
  "tiktok",
  "tiktok.com",
  "pinterest",
  "pinterest.com",
  "pinterest.co.za",
  "twitter",
  "twitter.com",
  "t.co",
  "x.com",
  "threads",
  "threads.net",
  "l.threads.net",
  "linkedin",
  "linkedin.com",
  "lnkd.in",
  "snapchat",
  "snapchat.com",
  "reddit",
  "reddit.com",
  "out.reddit.com",
  "whatsapp",
  "whatsapp.com",
  "wa.me",
  "api.whatsapp.com",
  "t.me",
  "tumblr",
  "quora",
  "medium.com",
  "line.me",
  "wechat",
  "vk.com",
  "linktr.ee",
]);
const PINTEREST_COUNTRY = /^[a-z]{2}[.]pinterest[.]com$/;

export const SEARCH_SOURCES: ReadonlySet<string> = new Set([
  "google",
  "search.google.com",
  "lens.google.com",
  "news.google.com",
  "play.google.com",
  "bing",
  "bing.com",
  "cn.bing.com",
  "yahoo",
  "duckduckgo",
  "duckduckgo.com",
  "ecosia",
  "ecosia.org",
  "brave",
  "search.brave.com",
  "baidu",
  "m.baidu.com",
  "msn",
  "msn.com",
  "aol",
  "search.aol.com",
]);
const GOOGLE_HOST = /^(www[.])?google[.][a-z.]+$/;

export const VIDEO_SOURCES: ReadonlySet<string> = new Set([
  "youtube",
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "vimeo",
  "vimeo.com",
  "twitch",
  "twitch.tv",
  "dailymotion",
  "dailymotion.com",
  "netflix",
]);

export const SHOPPING_SOURCES: ReadonlySet<string> = new Set([
  "google shopping",
  "google-shopping",
  "igshopping",
  "etsy",
  "etsy.com",
  "shopify",
  "shopify.com",
  "checkout.stripe.com",
]);

export const AI_SOURCES: ReadonlySet<string> = new Set([
  "chatgpt",
  "chatgpt.com",
  "chat.openai.com",
  "gemini.google.com",
  "copilot.microsoft.com",
  "deepseek.com",
  "chat.deepseek.com",
  "grok.com",
  "perplexity",
  "perplexity.ai",
  "www.perplexity.ai",
]);

const SOCIAL_MEDIUMS = new Set([
  "social",
  "social-network",
  "social-media",
  "sm",
  "social network",
  "social media",
]);
const DISPLAY_MEDIUMS = new Set([
  "display",
  "banner",
  "expandable",
  "interstitial",
  "cpm",
]);
const REFERRAL_MEDIUMS = new Set(["referral", "app", "link"]);
const EMAIL_WORDS = new Set(["email", "e-mail", "e_mail", "e mail"]);

function inSocial(source: string): boolean {
  return SOCIAL_SOURCES.has(source) || PINTEREST_COUNTRY.test(source);
}

function inSearch(source: string): boolean {
  return (
    SEARCH_SOURCES.has(source) ||
    GOOGLE_HOST.test(source) ||
    source.endsWith(".search.yahoo.com") ||
    source.startsWith("yandex")
  );
}

function inVideo(source: string): boolean {
  return VIDEO_SOURCES.has(source);
}

function inShopping(source: string): boolean {
  return (
    SHOPPING_SOURCES.has(source) ||
    source.startsWith("amazon") ||
    source.startsWith("ebay") ||
    source.startsWith("alibaba")
  );
}

function inAi(source: string): boolean {
  return AI_SOURCES.has(source);
}

/** Search engines get `<engine> / organic`; any other host `<host> / referral`. */
export function sourceFromReferrer(host: string): {
  source: string;
  medium: "organic" | "referral";
} {
  const h = host.trim().toLowerCase();
  if (GOOGLE_HOST.test(h)) return { source: "google", medium: "organic" };
  const bare = stripWww(h);
  if (bare === "bing.com" || bare === "cn.bing.com")
    return { source: "bing", medium: "organic" };
  if (bare === "search.yahoo.com" || bare.endsWith(".search.yahoo.com"))
    return { source: "yahoo", medium: "organic" };
  if (bare === "duckduckgo.com") return { source: "duckduckgo", medium: "organic" };
  if (bare === "ecosia.org") return { source: "ecosia", medium: "organic" };
  if (bare === "search.brave.com") return { source: "brave", medium: "organic" };
  if (bare.startsWith("yandex.") || bare.includes(".yandex."))
    return { source: "yandex", medium: "organic" };
  if (bare === "baidu.com" || bare === "m.baidu.com")
    return { source: "baidu", medium: "organic" };
  if (bare === "msn.com") return { source: "msn", medium: "organic" };
  if (bare === "search.aol.com") return { source: "aol", medium: "organic" };
  return { source: bare, medium: "referral" };
}

function fbclidPlatform(referrerHost: string | null): string {
  if (!referrerHost) return "facebook";
  const h = stripWww(referrerHost.toLowerCase());
  if (h === "instagram.com" || h.endsWith(".instagram.com")) return "instagram";
  if (h === "messenger.com" || h.endsWith(".messenger.com")) return "messenger";
  if (h === "threads.net" || h.endsWith(".threads.net")) return "threads";
  return "facebook";
}

function resolveSourceMedium(input: ClassifyInput): {
  source: string;
  medium: string;
  inferred: boolean;
} {
  const utmSource = normaliseSource(input.utmSource);
  const utmMedium = normaliseUtm(input.utmMedium);
  if (utmSource !== null || utmMedium !== null) {
    return {
      source: utmSource ?? "(not set)",
      medium: utmMedium ?? "(not set)",
      inferred: false,
    };
  }
  switch (input.clickIdType) {
    case "gclid":
    case "gbraid":
    case "wbraid":
      return { source: "google", medium: "cpc", inferred: false };
    case "msclkid":
      return { source: "bing", medium: "cpc", inferred: false };
    case "ttclid":
      return { source: "tiktok", medium: "paid_social", inferred: false };
    case "fbclid":
      return {
        source: fbclidPlatform(input.referrerHost),
        medium: "social",
        inferred: true,
      };
    default:
      break;
  }
  if (input.referrerHost) {
    const r = sourceFromReferrer(input.referrerHost);
    return { source: r.source, medium: r.medium, inferred: false };
  }
  if (input.inApp) {
    return { source: input.inApp, medium: "social", inferred: true };
  }
  return { source: "(direct)", medium: "(none)", inferred: false };
}

function channelFor(source: string, medium: string, campaign: string | null): Channel {
  const camp = campaign ?? "";
  // Charmistry overlay rules.
  if (source === "transactional") return "Transactional";
  if (medium === "influencer") return "Influencer";
  if (medium === "qr") return "QR codes";
  if (medium === "messaging") return "Messaging";
  if (source === "klaviyo") return medium === "sms" ? "SMS" : "Email";
  // GA4 default channel group.
  if (source === "(direct)" && (medium === "(not set)" || medium === "(none)"))
    return "Direct";
  if (camp.includes("cross-network")) return "Cross-network";
  const paid = PAID_MEDIUM.test(medium);
  if ((inShopping(source) || SHOP_CAMPAIGN.test(camp)) && paid) return "Paid shopping";
  if (inSearch(source) && paid) return "Paid search";
  if (inSocial(source) && paid) return "Paid social";
  if (inVideo(source) && paid) return "Paid video";
  if (DISPLAY_MEDIUMS.has(medium)) return "Display";
  if (paid) return "Paid other";
  if (inShopping(source) || SHOP_CAMPAIGN.test(camp)) return "Organic shopping";
  if (inSocial(source) || SOCIAL_MEDIUMS.has(medium)) return "Organic social";
  if (inVideo(source) || medium.includes("video")) return "Organic video";
  if (inSearch(source) || medium === "organic") return "Organic search";
  if (medium === "ai-assistant" || inAi(source)) return "AI assistant";
  if (REFERRAL_MEDIUMS.has(medium)) return "Referral";
  if (EMAIL_WORDS.has(source) || EMAIL_WORDS.has(medium)) return "Email";
  if (medium === "affiliate") return "Affiliates";
  if (medium === "audio") return "Audio";
  if (source === "sms" || medium === "sms") return "SMS";
  if (
    medium.endsWith("push") ||
    medium.includes("mobile") ||
    medium.includes("notification") ||
    source === "firebase"
  )
    return "Mobile push";
  return "Unassigned";
}

export function classify(input: ClassifyInput): Classified {
  const { source, medium, inferred } = resolveSourceMedium(input);
  const campaign = normaliseUtm(input.utmCampaign);
  const channel = channelFor(source, medium, campaign);
  return {
    channel,
    source,
    medium,
    campaign,
    inferred,
    excluded: channel === "Transactional",
  };
}

/** A missing touch is a direct visit. */
export function classifyTouch(t: Touch | null): Classified {
  if (!t) {
    return classify({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      clickIdType: null,
      referrerHost: null,
      inApp: null,
    });
  }
  return classify({
    utmSource: t.utmSource,
    utmMedium: t.utmMedium,
    utmCampaign: t.utmCampaign,
    clickIdType: t.clickIdType,
    referrerHost: t.referrerHost,
    inApp: t.inApp,
  });
}

/** Counts towards order attribution: not direct, not transactional. */
export function isAttributable(c: Classified): boolean {
  return !c.excluded && c.channel !== "Direct";
}
