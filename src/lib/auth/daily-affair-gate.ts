/**
 * Password gate for the unlaunched Daily Affair collection.
 *
 * This is a *soft launch* gate, not admin auth: the point is to hand a link and
 * a password to a handful of people before the collection goes public, without
 * the page being reachable or indexable by anyone else. The sibling
 * admin-gate.ts guards the admin tools with Basic Auth; a browser credential
 * dialog is the wrong front door for something you're showing to customers, so
 * this one renders a branded page instead and remembers the unlock in a cookie.
 *
 * Three states, driven by two switches:
 *   DAILY_AFFAIR_LIVE = true              -> public, no password, indexable
 *   LIVE false + DAILY_AFFAIR_PASSWORD    -> password page, noindex
 *   LIVE false + no password configured   -> 404, exactly as before the gate
 *
 * That last row is the fail-closed case and it is deliberate: an unset secret
 * leaves the collection *more* hidden, never less. It also means forgetting to
 * set the secret in Cloudflare can't accidentally expose the page.
 *
 * The cookie stores a SHA-256 of the password, never the password itself, so
 * rotating DAILY_AFFAIR_PASSWORD invalidates every outstanding unlock for free.
 * Comparison is constant-time via the shared helper.
 */

import { cookies } from "next/headers";
import { timingSafeEqual } from "./admin-gate";

export const DAILY_AFFAIR_COOKIE = "da_unlock";

/** 30 days — long enough that a reviewer isn't re-typing it every visit. */
export const DAILY_AFFAIR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** The configured password, or null when the collection should simply 404. */
export function dailyAffairPassword(): string | null {
  const secret = process.env.DAILY_AFFAIR_PASSWORD;
  return secret && secret.length > 0 ? secret : null;
}

/** Hex SHA-256 — the value the unlock cookie carries. */
export async function unlockToken(password: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** True when the caller submitted the right password. */
export async function passwordMatches(provided: string): Promise<boolean> {
  const expected = dailyAffairPassword();
  if (!expected) return false;
  return timingSafeEqual(provided, expected);
}

/** True when the request already carries a valid unlock cookie. */
export async function isUnlocked(): Promise<boolean> {
  const expected = dailyAffairPassword();
  if (!expected) return false;

  const jar = await cookies();
  const token = jar.get(DAILY_AFFAIR_COOKIE)?.value;
  if (!token) return false;

  return timingSafeEqual(token, await unlockToken(expected));
}
