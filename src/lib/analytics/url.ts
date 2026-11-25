/**
 * URL helpers for analytics: what part of a URL may be stored, what kind of
 * page it is, and which referrers count as a traffic source.
 *
 * Why this exists: URLs carry personal data in the wild (emails in query
 * strings, Klaviyo's `_kx` identity token, PayFast return parameters). The
 * tracker therefore stores the path only, never the query or hash; campaign
 * tags are read separately from an allow-list in touch.ts.
 */

import { isIgnoredReferrer } from "./normalise";
import type { PageType } from "./types";
import { LIMITS } from "./types";

/** The success and cancelled pages are reached from PayFast, never from a campaign. */
export const NO_TOUCH_PATHS: readonly string[] = [
  "/checkout/success",
  "/checkout/cancelled",
];

/** Path only (no query or hash), double slashes collapsed, capped, "/" if empty. */
export function sanitisePath(pathname: string): string {
  let p = typeof pathname === "string" ? pathname : "";
  const cut = p.search(/[?#]/);
  if (cut >= 0) p = p.slice(0, cut);
  p = p.replace(/\/{2,}/g, "/").trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p.slice(0, LIMITS.maxPath) || "/";
}

export function pageTypeFor(pathname: string): {
  pageType: PageType;
  productSlug: string | null;
} {
  const p = sanitisePath(pathname);
  if (p === "/") return { pageType: "home", productSlug: null };
  if (p === "/shop") return { pageType: "shop", productSlug: null };
  if (p === "/best-sellers" || p === "/collections" || p.startsWith("/collections/"))
    return { pageType: "listing", productSlug: null };
  const product = /^\/products\/([^/]+)$/.exec(p);
  if (product) {
    let slug = product[1];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      // keep the raw segment
    }
    return { pageType: "product", productSlug: slug.slice(0, LIMITS.maxString) };
  }
  if (p === "/checkout") return { pageType: "checkout", productSlug: null };
  if (p === "/checkout/success")
    return { pageType: "checkout_success", productSlug: null };
  if (p === "/checkout/cancelled")
    return { pageType: "checkout_cancelled", productSlug: null };
  if (p === "/account" || p.startsWith("/account/") || p === "/login")
    return { pageType: "account", productSlug: null };
  if (p === "/privacy" || p === "/shipping" || p === "/care" || p === "/faq")
    return { pageType: "info", productSlug: null };
  return { pageType: "other", productSlug: null };
}

/** Admin and API URLs are never tracked. */
export function isExcludedPath(pathname: string): boolean {
  const p = sanitisePath(pathname);
  return (
    p === "/admin" ||
    p.startsWith("/admin/") ||
    p === "/api" ||
    p.startsWith("/api/")
  );
}

/** Lowercased referrer host, or null if empty, invalid, our own site or PayFast. */
export function referrerHostOf(referrer: string, ownHost: string): string | null {
  if (!referrer) return null;
  let host: string;
  try {
    const u = new URL(referrer);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    host = u.hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host || isIgnoredReferrer(host, ownHost)) return null;
  return host.slice(0, LIMITS.maxString);
}
