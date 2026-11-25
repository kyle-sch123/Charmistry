/**
 * Decides how much the browser tracker may record on this device.
 *
 *   "off"          record nothing at all: the visitor opted out on /privacy,
 *                  this browser has used the admin key (staff), or it is an
 *                  automated browser (webdriver) without the local debug flag;
 *   "session_only" the browser sends Global Privacy Control or Do Not Track:
 *                  ids live in sessionStorage (gone when the tab closes) and
 *                  Meta's browser ids are never captured or shared;
 *   "full"         normal first-party measurement (POPIA legitimate interest,
 *                  explained on /privacy).
 */

import { DEBUG_KEY, OPT_OUT_KEY, STAFF_KEY } from "./types";

export type PrivacyMode = "off" | "session_only" | "full";

function localGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The E2E override: only with the debug flag, and only locally or outside production. */
export function debugAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (localGet(DEBUG_KEY) !== "1") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || process.env.NODE_ENV !== "production";
}

export function privacyMode(): PrivacyMode {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "off";
  if (localGet(OPT_OUT_KEY) === "1") return "off";
  if (localGet(STAFF_KEY)) return "off";
  if (navigator.webdriver === true && !debugAllowed()) return "off";
  const nav = navigator as Navigator & {
    globalPrivacyControl?: boolean;
    msDoNotTrack?: string;
  };
  const win = window as Window & { doNotTrack?: string };
  if (
    nav.globalPrivacyControl === true ||
    nav.doNotTrack === "1" ||
    win.doNotTrack === "1" ||
    nav.msDoNotTrack === "1"
  ) {
    return "session_only";
  }
  return "full";
}
