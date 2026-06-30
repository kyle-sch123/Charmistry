/**
 * Klaviyo server-side marketing-event tracking (modern Events API).
 *
 * Opt-in: when KLAVIYO_API_KEY is unset, isKlaviyoConfigured() returns
 * false and the PayFast ITN handler skips event emission.
 *
 * Auth model (this is the bit that bites): the PRIVATE key (pk_…) authenticates
 * the modern Events API via the `Authorization: Klaviyo-API-Key` header. It must
 * NOT be used as the `token` on the legacy base64 `/api/track` endpoint — that
 * endpoint authenticates with the 6-char PUBLIC Site ID and Klaviyo explicitly
 * warns against sending a private key to it. The legacy v1/v2 APIs also retired
 * 2024-06-30. We previously POSTed the private key to `/api/track`, so every
 * order event was silently rejected. This module now targets `/api/events/`.
 *
 * Events emitted today (from the PayFast ITN handler, on payment):
 *   - "Placed Order"     — one per order, carries the full Items array.
 *   - "Ordered Product"  — one per line item, for product-level segmentation.
 *
 * Legacy special properties from callers are mapped onto first-class Events API
 * attributes so call sites don't have to change:
 *   - $event_id → unique_id  — idempotency/dedupe key. Re-sending the same
 *                              event + unique_id is a no-op, so ITN redeliveries
 *                              can't double-count.
 *   - $value    → value      — numeric revenue for the event.
 * Everything else stays in the custom `properties` bag. Customer identity is
 * mapped onto the event's embedded `profile`.
 */

const KLAVIYO_EVENTS_URL = "https://a.klaviyo.com/api/events/";
// Pinned API revision. 2024-10-15 is the stable revision this integration was
// verified against; bump deliberately (Klaviyo versions breaking changes by date).
const KLAVIYO_REVISION = "2024-10-15";

/** Read at call time, not module load — env is populated per-request on Workers. */
function getKlaviyoApiKey(): string | undefined {
  return process.env.KLAVIYO_API_KEY;
}

export function isKlaviyoConfigured(): boolean {
  return Boolean(getKlaviyoApiKey());
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

// Klaviyo rejects a malformed phone_number on the profile and 400s the WHOLE
// event, so we only attach it when it looks like E.164 (+ country code + digits).
// Raw local-format ZA numbers (e.g. "0677…") are dropped rather than risk the
// whole Placed Order failing — the address still enriches the profile.
function toE164(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const trimmed = phone.trim();
  return /^\+[1-9]\d{6,14}$/.test(trimmed) ? trimmed : undefined;
}

export async function trackKlaviyoEvent(
  event: string,
  customer: KlaviyoCustomer,
  properties: Record<string, unknown>,
  /** UNIX timestamp (seconds) for when the event occurred. Defaults to now. */
  time?: number,
): Promise<void> {
  const apiKey = getKlaviyoApiKey();
  if (!apiKey) return;

  // Split the legacy $-prefixed keys out of the custom property bag and onto
  // their first-class Events API homes.
  const { $event_id, $value, ...customProps } = properties as {
    $event_id?: unknown;
    $value?: unknown;
    [k: string]: unknown;
  };

  // Build the embedded profile. Only set keys we actually have so we never
  // overwrite a richer profile with empty values.
  const profileAttributes: Record<string, unknown> = { email: customer.email };
  if (customer.first_name) profileAttributes.first_name = customer.first_name;
  if (customer.last_name) profileAttributes.last_name = customer.last_name;
  const phoneE164 = toE164(customer.phone);
  if (phoneE164) profileAttributes.phone_number = phoneE164;

  const location: Record<string, unknown> = {};
  if (customer.address1) location.address1 = customer.address1;
  if (customer.address2) location.address2 = customer.address2;
  if (customer.city) location.city = customer.city;
  if (customer.region) location.region = customer.region;
  if (customer.zip) location.zip = customer.zip;
  if (customer.country) location.country = customer.country;
  if (Object.keys(location).length > 0) profileAttributes.location = location;

  const attributes: Record<string, unknown> = {
    properties: customProps,
    metric: { data: { type: "metric", attributes: { name: event } } },
    profile: { data: { type: "profile", attributes: profileAttributes } },
  };
  if (typeof $value === "number" && Number.isFinite($value)) {
    attributes.value = $value;
  }
  if ($event_id != null) attributes.unique_id = String($event_id);
  if (time) attributes.time = new Date(time * 1000).toISOString();

  const response = await fetch(KLAVIYO_EVENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      revision: KLAVIYO_REVISION,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ data: { type: "event", attributes } }),
  });

  // The Events API returns 202 Accepted on success. Anything else is a real
  // failure — surface it so the ITN handler logs it (vs the old silent 200/"0").
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Klaviyo event "${event}" failed: ${response.status} ${response.statusText} - ${text}`,
    );
  }
}
