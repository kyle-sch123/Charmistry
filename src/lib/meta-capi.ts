/**
 * Meta (Facebook) Conversions API — server-side Purchase events.
 *
 * Why this exists:
 * The browser pixel (see `fpixel.ts`) is the *only* thing that used to report
 * purchases, and it fires client-side from the success page — so it is lost to
 * ad-blockers, Safari ITP and iOS. With a small order volume that leaves Meta
 * with a sparse, clustered sample of purchase values, which is what trips its
 * "all your Purchase events send the same price data" diagnostic. Firing the
 * conversion server-side from the authoritative PayFast ITN handler fixes that:
 * every paid order is reported once, with the real server-priced total, and it
 * can't be blocked.
 *
 * Deduplication:
 * The browser pixel now sends `eventID = order.id` and this module sends the
 * same value as `event_id`. Meta dedupes a pixel + CAPI pair that share the
 * same event_id AND event_name, so a customer whose browser pixel DID fire is
 * counted once, not twice.
 *
 * Match quality caveat:
 * The ITN is a server-to-server callback from PayFast, so we do NOT have the
 * shopper's browser IP / user-agent / `_fbp`/`_fbc` cookies here. Matching
 * therefore relies on hashed PII (email, phone, name, city, zip, country),
 * which Meta requires to be SHA-256 hex of normalized values. That is the
 * standard trade-off for webhook-fired CAPI and is still a strong signal.
 *
 * Opt-in: when META_CAPI_ACCESS_TOKEN (or the pixel id) is unset,
 * isMetaCapiConfigured() returns false and the ITN handler skips this.
 */

// Pinned Graph API version. Bump deliberately — Meta versions breaking changes.
const GRAPH_VERSION = "v21.0";

/** Read at call time, not module load — env is populated per-request on Workers. */
function getPixelId(): string | undefined {
  // Reuse the same numeric pixel id the browser bundle is built with. It is not
  // secret; the access token below is what authorises the server-side call.
  return process.env.NEXT_PUBLIC_FB_PIXEL_ID;
}

function getAccessToken(): string | undefined {
  return process.env.META_CAPI_ACCESS_TOKEN;
}

/** Optional: routes events to the Events Manager "Test Events" tab for verification. */
function getTestEventCode(): string | undefined {
  return process.env.META_CAPI_TEST_EVENT_CODE || undefined;
}

export function isMetaCapiConfigured(): boolean {
  return Boolean(getPixelId() && getAccessToken());
}

// SHA-256 hex via Web Crypto — available on both the Node runtime (Node 20+)
// and Cloudflare's workerd, so no `node:crypto` import (which workerd lacks).
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hash a PII field after normalising it, or resolve to undefined when empty so
 * we never send a hash of "" (which would falsely match other empty fields).
 */
async function hashField(
  raw: string | null | undefined,
  normalize: (s: string) => string,
): Promise<string | undefined> {
  if (!raw) return undefined;
  const normalized = normalize(raw.trim());
  if (!normalized) return undefined;
  return sha256Hex(normalized);
}

const lower = (s: string) => s.toLowerCase();
// City / name-style fields: lowercase and strip anything that isn't a letter or
// digit (Meta's documented normalization for ct/fn/ln/zp-ish fields).
const alnumLower = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Phone → digits only, with country code, no leading "+". Best-effort ZA
// normalization: a local "0XXXXXXXXX" becomes "27XXXXXXXXX". Anything that
// doesn't look like a plausible number after stripping is dropped.
function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length >= 10) {
    digits = "27" + digits.slice(1);
  }
  return digits;
}

const COUNTRY = (s: string) => s.toLowerCase().slice(0, 2);

export interface MetaCapiCustomer {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
}

export interface MetaCapiPurchase {
  /** Dedup key — MUST equal the browser pixel's `eventID` (= order id). */
  eventId: string;
  /** UNIX timestamp (seconds) the purchase occurred. */
  eventTime: number;
  /** The success page URL, for Meta's event_source_url. */
  eventSourceUrl?: string;
  value: number;
  currency: string;
  contents: Array<{ id: string; quantity: number; item_price: number }>;
  contentIds: string[];
  numItems: number;
  orderId: string;
}

/**
 * POST a single Purchase event to the Conversions API. Best-effort: throws on a
 * non-2xx so the ITN handler can log it via Promise.allSettled, but never blocks
 * the confirmation-email path.
 */
export async function trackMetaPurchase(
  customer: MetaCapiCustomer,
  purchase: MetaCapiPurchase,
): Promise<void> {
  const pixelId = getPixelId();
  const accessToken = getAccessToken();
  if (!pixelId || !accessToken) return;

  const [em, ph, fn, ln, ct, zp, country] = await Promise.all([
    hashField(customer.email, lower),
    hashField(customer.phone, normalizePhone),
    hashField(customer.first_name, alnumLower),
    hashField(customer.last_name, alnumLower),
    hashField(customer.city, alnumLower),
    hashField(customer.zip, alnumLower),
    hashField(customer.country, COUNTRY),
  ]);

  // Meta expects each user_data field as an array of hashes. Only include the
  // ones we actually have.
  const userData: Record<string, string[]> = {};
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];
  if (ct) userData.ct = [ct];
  if (zp) userData.zp = [zp];
  if (country) userData.country = [country];

  const eventData = {
    event_name: "Purchase",
    event_time: purchase.eventTime,
    event_id: purchase.eventId,
    event_source_url: purchase.eventSourceUrl,
    action_source: "website",
    user_data: userData,
    custom_data: {
      currency: purchase.currency,
      value: purchase.value,
      content_type: "product",
      content_ids: purchase.contentIds,
      contents: purchase.contents,
      num_items: purchase.numItems,
      order_id: purchase.orderId,
    },
  };

  const testEventCode = getTestEventCode();
  const body: Record<string, unknown> = { data: [eventData] };
  if (testEventCode) body.test_event_code = testEventCode;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(
    accessToken,
  )}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Meta CAPI Purchase failed: ${response.status} ${response.statusText} - ${text}`,
    );
  }
}
