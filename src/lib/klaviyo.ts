/**
 * Klaviyo server-side marketing-event tracking.
 *
 * Opt-in: when KLAVIYO_API_KEY is unset, isKlaviyoConfigured() returns
 * false and the PayFast ITN handler skips event emission. We use the legacy
 * `/api/track` endpoint (base64-encoded GET) — it's still supported, matches
 * Klaviyo's "integrate a platform" guide, and is simpler than the v3 API for
 * one-off server-side calls.
 *
 * Events emitted today (from the PayFast ITN handler, on payment):
 *   - "Placed Order"     — one per order, carries the full Items array.
 *   - "Ordered Product"  — one per line item, for product-level segmentation.
 *
 * Klaviyo special properties (set by callers in `properties`):
 *   - $event_id  — dedupe key. Re-sending the same event + $event_id is a
 *                  no-op, so ITN redeliveries can't double-count.
 *   - $value     — numeric revenue for the event.
 * Customer identity ($email, $first_name, …) is mapped from `customer` below.
 */

const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;
const KLAVIYO_TRACK_URL = "https://a.klaviyo.com/api/track";

export function isKlaviyoConfigured(): boolean {
  return Boolean(KLAVIYO_API_KEY);
}

export interface KlaviyoCustomer {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  zip?: string | null;
  region?: string | null;
  country?: string | null;
}

export async function trackKlaviyoEvent(
  event: string,
  customer: KlaviyoCustomer,
  properties: Record<string, unknown>,
  /** UNIX timestamp (seconds) for when the event occurred. Defaults to now. */
  time?: number,
): Promise<void> {
  if (!KLAVIYO_API_KEY) {
    return;
  }

  // Map our customer shape onto Klaviyo's reserved $-prefixed identity keys.
  // Only set keys we actually have so we never overwrite a richer profile
  // with empty strings.
  const customer_properties: Record<string, unknown> = {
    $email: customer.email,
  };
  if (customer.first_name) customer_properties.$first_name = customer.first_name;
  if (customer.last_name) customer_properties.$last_name = customer.last_name;
  if (customer.phone) customer_properties.$phone_number = customer.phone;
  if (customer.address1) customer_properties.$address1 = customer.address1;
  if (customer.address2) customer_properties.$address2 = customer.address2;
  if (customer.city) customer_properties.$city = customer.city;
  if (customer.zip) customer_properties.$zip = customer.zip;
  if (customer.region) customer_properties.$region = customer.region;
  if (customer.country) customer_properties.$country = customer.country;

  const payload: Record<string, unknown> = {
    token: KLAVIYO_API_KEY,
    event,
    customer_properties,
    properties,
  };
  if (time) payload.time = time;

  const data = Buffer.from(JSON.stringify(payload)).toString("base64");
  const response = await fetch(
    `${KLAVIYO_TRACK_URL}?data=${encodeURIComponent(data)}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Klaviyo track event failed: ${response.status} ${response.statusText} - ${text}`,
    );
  }
}
