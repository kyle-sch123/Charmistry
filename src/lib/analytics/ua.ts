/**
 * Coarse device, browser and OS from the user agent, and bot detection.
 * Server side only (the collect API), so the parsing never ships to shoppers.
 *
 * Why coarse: the dashboard compares phones, tablets and computers and wants
 * to spot an in-app browser; it never needs a version number or a model.
 */

import type { DeviceClass } from "./types";

export interface ParsedAgent {
  device: DeviceClass;
  browser: string | null;
  os: string | null;
}

export function parseUserAgent(ua: string | null | undefined, hint: DeviceClass | null): ParsedAgent {
  const s = ua ?? "";
  // The browser's touch-screen hint wins: iPads send a Mac user agent.
  const tablet =
    hint === "tablet" ||
    (hint !== "mobile" &&
      (/iPad|Tablet|PlayBook|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))));
  const mobile =
    !tablet && (hint === "mobile" || /Mobi|iPhone|iPod|Android|Windows Phone|BlackBerry/i.test(s));
  const device: DeviceClass = tablet ? "tablet" : mobile ? "mobile" : "desktop";

  let browser: string | null = null;
  if (/Instagram/.test(s)) browser = "Instagram app";
  else if (/FBAN|FBAV/.test(s)) browser = "Facebook app";
  else if (/TikTok|musical_ly|Bytedance/i.test(s)) browser = "TikTok app";
  else if (/Edg\//.test(s)) browser = "Edge";
  else if (/SamsungBrowser/.test(s)) browser = "Samsung Internet";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/Firefox\/|FxiOS/.test(s)) browser = "Firefox";
  else if (/CriOS|Chrome\//.test(s)) browser = "Chrome";
  else if (/Safari\//.test(s)) browser = "Safari";
  else if (s) browser = "Other";

  let os: string | null = null;
  if (/iPhone|iPod/.test(s)) os = "iOS";
  else if (/iPad/.test(s) || (hint === "tablet" && /Macintosh/.test(s))) os = "iPadOS";
  else if (/Android/.test(s)) os = "Android";
  else if (/Windows/.test(s)) os = "Windows";
  else if (/CrOS/.test(s)) os = "ChromeOS";
  else if (/Mac OS X|Macintosh/.test(s)) os = "macOS";
  else if (/Linux/.test(s)) os = "Linux";
  else if (s) os = "Other";

  return { device, browser, os };
}

/** Crawlers, link previews and headless browsers are never counted. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || !ua.trim()) return true;
  return /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|bingpreview/i.test(ua);
}
