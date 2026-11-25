/**
 * The browser side of first-party analytics: one lazily started singleton
 * that records page views (with engaged time and scroll depth), shop events
 * and campaign touches, and sends them in small batches to
 * /api/analytics/collect.
 *
 * Why it is built like this:
 *   - Performance: nothing runs before the page is idle except a synchronous
 *     storage read; listeners are passive and throttled; data leaves by
 *     `sendBeacon` (text/plain, so no CORS preflight) and is never retried.
 *   - Privacy: off entirely for opted-out visitors, staff browsers and admin
 *     pages; session-only ids under GPC/DNT; the query string is never stored
 *     and only allow-listed campaign tags are read (never Klaviyo's `_kx`).
 *   - Accuracy: a touch is recorded only on a full page load (never on a
 *     client-side navigation, a reload or back/forward), and the session
 *     rolls over after 30 idle minutes exactly as GA4 does.
 */

import type { AnyEventPayload, EventName, EventProps } from "./events";
import { newId } from "./ids";
import { debugAllowed, privacyMode, type PrivacyMode } from "./privacy";
import {
  accumulateEngaged,
  engagedSoFar,
  nextSession,
  pickAttribution,
  type EngagedState,
} from "./session";
import { clearStores, loadStore, saveStore, type AnalyticsStore } from "./storage";
import {
  isAttributableTouch,
  shouldRecordTouch,
  touchFingerprint,
  touchFromLanding,
  type NavigationKind,
} from "./touch";
import type { CheckoutAttribution, CollectPayload, DeviceClass, PageType, PageViewPayload, Touch } from "./types";
import { ATTRIBUTION_WINDOW_MS, COLLECT_PATH, LIMITS, STAFF_KEY } from "./types";
import { isExcludedPath, NO_TOUCH_PATHS, pageTypeFor, sanitisePath } from "./url";

interface View {
  id: string;
  path: string;
  pageType: PageType;
  productSlug: string | null;
  at: string;
  engaged: EngagedState;
  maxScroll: number;
  title: string | null;
  sentEngaged: number;
  sentScroll: number;
}

const QUEUE_FLUSH_AT = 20;
const QUEUE_FLUSH_DELAY_MS = 15_000;
const HEARTBEAT_MS = 30_000;
const PERSIST_EVERY_MS = 5_000;
const ACTIVITY_THROTTLE_MS = 1_000;

const state = {
  initialised: false,
  disabled: false,
  mode: "full" as PrivacyMode,
  store: null as AnalyticsStore | null,
  view: null as View | null,
  finished: [] as PageViewPayload[],
  events: [] as AnyEventPayload[],
  listening: false,
  flushTimer: null as ReturnType<typeof setTimeout> | null,
  lastPersist: 0,
  lastActivity: 0,
  scrollQueued: false,
};

const iso = (ms: number) => new Date(ms).toISOString();
const isVisible = () => document.visibilityState === "visible";

function storageMode(): "full" | "session_only" {
  return state.mode === "session_only" ? "session_only" : "full";
}

function navigationType(): NavigationKind {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const t = nav?.type;
    if (t === "reload" || t === "back_forward" || t === "prerender") return t;
  } catch {
    // older browsers
  }
  return "navigate";
}

function deviceHint(): DeviceClass | null {
  const ua = navigator.userAgent;
  // iPadOS 13+ Safari reports a Mac user agent; touch support gives it away.
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "tablet";
  return null;
}

function persist(force: boolean, now = Date.now()): void {
  if (!state.store) return;
  if (!force && now - state.lastPersist < PERSIST_EVERY_MS) return;
  state.lastPersist = now;
  saveStore(state.store, storageMode());
}

function recordTouch(store: AnalyticsStore, t: Touch): void {
  const fingerprint = touchFingerprint(t);
  store.touches = [...store.touches, { ...t, fingerprint }].slice(-20);
  store.unsent = [...store.unsent, t].slice(-LIMITS.maxTouches);
  if (!store.firstTouch && isAttributableTouch(t)) store.firstTouch = t;
  store.lastTouchMark = { fingerprint, at: t.at };
  if (state.mode === "full" && t.clickIdType === "fbclid" && t.clickId) {
    store.fbclid = { value: t.clickId, at: t.at };
  }
}

function startView(path: string, now: number): void {
  const { pageType, productSlug } = pageTypeFor(path);
  const id = newId();
  state.view = {
    id,
    path,
    pageType,
    productSlug,
    at: iso(now),
    engaged: { engagedMs: 0, lastMark: isVisible() ? now : null },
    maxScroll: 0,
    title: null,
    sentEngaged: -1,
    sentScroll: -1,
  };
  measureScroll();
  // Next sets the document title after the route renders; read it shortly after.
  setTimeout(() => {
    if (state.view?.id === id && document.title) state.view.title = document.title.slice(0, LIMITS.maxTitle);
  }, 1000);
}

function snapshot(view: View, now: number): PageViewPayload {
  return {
    id: view.id,
    at: view.at,
    path: view.path,
    pageType: view.pageType,
    productSlug: view.productSlug,
    title: view.title,
    engagedMs: Math.round(engagedSoFar(view.engaged, now)),
    maxScrollPct: view.maxScroll,
  };
}

function finishView(now: number): void {
  const view = state.view;
  if (!view) return;
  state.view = null;
  view.engaged = accumulateEngaged(view.engaged, now, false);
  state.finished.push(snapshot(view, now));
}

/** Keep the session alive; after 30 idle minutes, send what we have and start a new one. */
function touchSession(now: number): void {
  const store = state.store;
  if (!store) return;
  const { session, isNew } = nextSession(store.session, now);
  if (isNew && store.session) {
    flush("rollover");
    const path = state.view?.path ?? sanitisePath(window.location.pathname);
    state.view = null;
    store.session = { ...session, landingPath: path };
    if (!isExcludedPath(path)) startView(path, now);
    persist(true, now);
    return;
  }
  store.session = { ...session, landingPath: store.session?.landingPath ?? session.landingPath };
  persist(false, now);
}

/** Starts the tracker for this document (once). Returns false when it must stay off. */
function ensureStarted(): boolean {
  if (state.initialised) return !state.disabled;
  state.initialised = true;
  if (typeof window === "undefined") {
    state.disabled = true;
    return false;
  }
  const path = sanitisePath(window.location.pathname);
  const mode = privacyMode();
  if (mode === "off" || isExcludedPath(path)) {
    state.disabled = true;
    return false;
  }
  state.mode = mode;
  const now = Date.now();
  const store = loadStore(storageMode(), now);
  state.store = store;
  const { session, isNew } = nextSession(store.session, now);
  store.session = isNew ? { ...session, landingPath: path } : { ...store.session, ...session };

  if (!NO_TOUCH_PATHS.includes(path)) {
    const candidate = touchFromLanding({
      search: window.location.search,
      pathname: path,
      referrer: document.referrer,
      ownHost: window.location.hostname,
      userAgent: navigator.userAgent,
      now: new Date(now),
    });
    if (candidate && shouldRecordTouch(candidate, store.lastTouchMark, now, navigationType())) {
      recordTouch(store, candidate);
    }
  }
  startView(path, now);
  persist(true, now);
  return true;
}

function send(json: string): void {
  try {
    if (
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(COLLECT_PATH, new Blob([json], { type: "text/plain;charset=UTF-8" }))
    ) {
      return;
    }
  } catch {
    // fall through to fetch
  }
  try {
    void fetch(COLLECT_PATH, {
      method: "POST",
      body: json,
      keepalive: true,
      credentials: "same-origin",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    }).catch(() => undefined);
  } catch {
    // dropped by design: analytics never retries or surfaces errors
  }
}

function staffNow(): boolean {
  try {
    return Boolean(window.localStorage.getItem(STAFF_KEY));
  } catch {
    return false;
  }
}

/** Send everything queued. Never throws, never retries. */
export function flush(reason: string): void {
  void reason;
  if (state.disabled || !state.initialised || !state.store?.session) return;
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = null;
  }
  if (staffNow()) {
    disableTracking(false);
    return;
  }
  const store = state.store;
  const session = store.session!;
  const now = Date.now();
  const views = [...state.finished];
  let current: PageViewPayload | null = null;
  if (state.view) {
    if (!state.view.title && document.title) state.view.title = document.title.slice(0, LIMITS.maxTitle);
    current = snapshot(state.view, now);
    if (current.engagedMs !== state.view.sentEngaged || current.maxScrollPct !== state.view.sentScroll) {
      views.push(current);
    }
  }
  const events = state.events.slice(0, LIMITS.maxEvents);
  const touches = store.unsent.slice(-LIMITS.maxTouches);
  if (views.length === 0 && events.length === 0 && touches.length === 0) return;

  const payload: CollectPayload = {
    v: 1,
    visitorId: store.visitorId,
    sessionOnly: state.mode === "session_only",
    session: {
      id: session.id,
      startedAt: session.startedAt,
      landingPath: session.landingPath ?? "/",
      deviceHint: deviceHint(),
    },
    touches,
    pageViews: views.slice(-LIMITS.maxPageViews),
    events,
  };
  if (debugAllowed()) payload.debug = true;
  send(JSON.stringify(payload));

  state.finished = [];
  state.events = state.events.slice(events.length);
  store.unsent = [];
  if (state.view && current) {
    state.view.sentEngaged = current.engagedMs;
    state.view.sentScroll = current.maxScrollPct;
  }
  persist(true, now);
}

function scheduleFlush(): void {
  if (state.flushTimer) return;
  state.flushTimer = setTimeout(() => {
    state.flushTimer = null;
    flush("timer");
  }, QUEUE_FLUSH_DELAY_MS);
}

/** Record a page view for the current URL (client-side navigations call this). */
export function pageView(): void {
  if (!ensureStarted()) return;
  const path = sanitisePath(window.location.pathname);
  if (state.view && state.view.path === path) return;
  const now = Date.now();
  finishView(now);
  if (isExcludedPath(path)) return;
  touchSession(now);
  if (!state.view) startView(path, now);
  if (state.finished.length >= LIMITS.maxPageViews) flush("views");
}

/** Record a shop event. */
export function track<N extends EventName>(name: N, props: EventProps[N]): void {
  if (!ensureStarted()) return;
  const now = Date.now();
  touchSession(now);
  state.events.push({
    id: newId(),
    name,
    at: iso(now),
    pageViewId: state.view?.id ?? null,
    props,
  } as AnyEventPayload);
  if (state.events.length >= QUEUE_FLUSH_AT) flush("queue");
  else scheduleFlush();
}

function measureScroll(): void {
  if (state.scrollQueued) return;
  state.scrollQueued = true;
  requestAnimationFrame(() => {
    state.scrollQueued = false;
    const view = state.view;
    if (!view) return;
    const height = document.documentElement.scrollHeight;
    if (height <= 0) return;
    const pct = Math.round(((window.scrollY + window.innerHeight) / height) * 100);
    view.maxScroll = Math.max(view.maxScroll, Math.min(100, Math.max(0, pct)));
  });
}

function onActivity(): void {
  const now = Date.now();
  if (now - state.lastActivity < ACTIVITY_THROTTLE_MS) return;
  state.lastActivity = now;
  if (state.view && isVisible()) state.view.engaged = accumulateEngaged(state.view.engaged, now, true);
  touchSession(now);
}

function onScroll(): void {
  measureScroll();
  onActivity();
}

function onVisibility(): void {
  const now = Date.now();
  const visible = isVisible();
  if (state.view) state.view.engaged = accumulateEngaged(state.view.engaged, now, visible);
  if (!visible) flush("hidden");
}

function onPageHide(): void {
  const now = Date.now();
  if (state.view) state.view.engaged = accumulateEngaged(state.view.engaged, now, false);
  flush("pagehide");
}

function onPageShow(e: PageTransitionEvent): void {
  // Restored from the back/forward cache: count it as a fresh view.
  if (!e.persisted || state.disabled) return;
  const now = Date.now();
  finishView(now);
  touchSession(now);
  const path = sanitisePath(window.location.pathname);
  if (!state.view && !isExcludedPath(path)) startView(path, now);
}

/** Attach the listeners (called when the page is idle). */
export function start(): void {
  if (!ensureStarted() || state.listening) return;
  state.listening = true;
  const passive = { passive: true } as const;
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("scroll", onScroll, passive);
  for (const type of ["pointerdown", "keydown", "touchstart", "mousemove"] as const) {
    window.addEventListener(type, onActivity, passive);
  }
  setInterval(() => {
    if (!state.view || !isVisible()) return;
    const engaged = Math.round(engagedSoFar(state.view.engaged, Date.now()));
    if (engaged !== state.view.sentEngaged || state.view.maxScroll !== state.view.sentScroll) {
      flush("heartbeat");
    }
  }, HEARTBEAT_MS);
}

/** The /privacy opt-out: stop now and forget this device's analytics state. */
export function disableTracking(clear = true): void {
  state.disabled = true;
  state.initialised = true;
  state.view = null;
  state.finished = [];
  state.events = [];
  state.store = null;
  if (clear) clearStores();
}

function readCookie(name: string): string | null {
  try {
    const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
    const value = match ? decodeURIComponent(match.slice(name.length + 1)) : null;
    return value && /^fb\.\d\.\d+\.[\w.~+/=-]{1,200}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

/** What /api/checkout records about how this visitor found the shop (null when tracking is off). */
export function getCheckoutAttribution(): CheckoutAttribution | null {
  if (!ensureStarted() || !state.store?.session) return null;
  const store = state.store;
  const now = Date.now();
  const pick = pickAttribution(store, now);
  const full = state.mode === "full";
  const fbclidFresh =
    full && store.fbclid && now - Date.parse(store.fbclid.at) <= ATTRIBUTION_WINDOW_MS ? store.fbclid : null;
  return {
    visitorId: store.visitorId,
    sessionId: store.session!.id,
    firstTouch: pick.firstTouch,
    lastTouch: pick.lastTouch,
    touchCount: pick.touchCount,
    fbclid: fbclidFresh,
    fbp: full ? readCookie("_fbp") : null,
    fbc: full ? readCookie("_fbc") : null,
  };
}

/**
 * First-touch profile properties for Klaviyo's identify call. Only in full
 * mode, and the classifier is loaded on demand so it never weighs down the
 * storefront bundle.
 */
export async function getKlaviyoFirstTouchProps(): Promise<Record<string, string> | null> {
  if (!ensureStarted() || state.mode !== "full") return null;
  const first = state.store?.firstTouch;
  if (!first) return null;
  const { classifyTouch } = await import("./channel");
  const c = classifyTouch(first);
  const atMs = Date.parse(first.at);
  return {
    charmistry_first_source: c.source,
    charmistry_first_medium: c.medium,
    charmistry_first_campaign: c.campaign ?? "",
    charmistry_first_channel: c.channel,
    charmistry_first_seen: Number.isFinite(atMs)
      ? new Date(atMs + 2 * 3_600_000).toISOString().slice(0, 10)
      : "",
  };
}
