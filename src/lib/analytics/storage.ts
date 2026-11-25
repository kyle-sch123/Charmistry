/**
 * Where the tracker keeps its state on the device: one JSON object under
 * STORAGE_KEY.
 *
 * Why so defensive: private browsing, in-app browsers and full disks make
 * localStorage throw. Every access is wrapped; in "full" mode we fall back
 * from localStorage to sessionStorage to memory, and in "session_only" mode
 * (GPC / DNT) we never touch localStorage at all.
 */

import { newId, isUuid } from "./ids";
import type { SessionState } from "./session";
import type { Touch } from "./types";
import { ATTRIBUTION_WINDOW_MS, STORAGE_KEY, TOUCH_RETENTION_MS } from "./types";

export interface StoredTouch extends Touch {
  fingerprint: string;
}

export interface AnalyticsStore {
  v: 1;
  visitorId: string;
  session: SessionState | null;
  /** at most 20, none older than 90 days */
  touches: StoredTouch[];
  /** kept for at most 13 months */
  firstTouch: Touch | null;
  lastTouchMark: { fingerprint: string; at: string } | null;
  fbclid: { value: string; at: string } | null;
  /** touches recorded but not yet sent */
  unsent: Touch[];
}

const MAX_TOUCHES = 20;
let memory: string | null = null;

type StorageKind = "local" | "session";

function tryStorage(kind: StorageKind): Storage | null {
  try {
    const s = kind === "local" ? window.localStorage : window.sessionStorage;
    const probe = "__charmistry_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function backing(mode: "full" | "session_only"): Storage | null {
  if (typeof window === "undefined") return null;
  return mode === "full"
    ? (tryStorage("local") ?? tryStorage("session"))
    : tryStorage("session");
}

function fresh(): AnalyticsStore {
  return {
    v: 1,
    visitorId: newId(),
    session: null,
    touches: [],
    firstTouch: null,
    lastTouchMark: null,
    fbclid: null,
    unsent: [],
  };
}

function age(at: string | undefined, now: number): number {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) ? now - t : Number.POSITIVE_INFINITY;
}

/** Load (or create) the store, pruning anything past its retention. */
export function loadStore(mode: "full" | "session_only", now: number): AnalyticsStore {
  let raw: string | null = null;
  const s = backing(mode);
  try {
    raw = s ? s.getItem(STORAGE_KEY) : memory;
  } catch {
    raw = memory;
  }
  let store: AnalyticsStore;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<AnalyticsStore>) : null;
    store =
      parsed && parsed.v === 1 && isUuid(parsed.visitorId)
        ? {
            ...fresh(),
            ...parsed,
            touches: Array.isArray(parsed.touches) ? parsed.touches : [],
            unsent: Array.isArray(parsed.unsent) ? parsed.unsent : [],
          }
        : fresh();
  } catch {
    store = fresh();
  }
  store.touches = store.touches
    .filter((t) => age(t.at, now) <= ATTRIBUTION_WINDOW_MS)
    .slice(-MAX_TOUCHES);
  if (store.firstTouch && age(store.firstTouch.at, now) > TOUCH_RETENTION_MS) {
    store.firstTouch = null;
  }
  if (store.fbclid && age(store.fbclid.at, now) > ATTRIBUTION_WINDOW_MS) {
    store.fbclid = null;
  }
  store.unsent = store.unsent.slice(-3);
  return store;
}

export function saveStore(store: AnalyticsStore, mode: "full" | "session_only"): void {
  const json = JSON.stringify(store);
  const s = backing(mode);
  try {
    if (s) s.setItem(STORAGE_KEY, json);
    else memory = json;
  } catch {
    memory = json;
  }
}

/** Forget everything on this device (the /privacy opt-out). */
export function clearStores(): void {
  memory = null;
  for (const kind of ["local", "session"] as const) {
    try {
      (kind === "local" ? window.localStorage : window.sessionStorage).removeItem(STORAGE_KEY);
    } catch {
      // nothing to clear
    }
  }
}
