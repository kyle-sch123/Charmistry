/**
 * Courier Guy (thecourierguy.co.za) shipment creation.
 *
 * Called from the PayFast ITN handler after an order is marked paid. The whole
 * integration is opt-in: if either COURIER_GUY_API_BASE_URL or
 * COURIER_GUY_API_KEY is missing, isCourierGuyConfigured() returns false
 * and the webhook skips dispatch entirely.
 *
 * The response shape from Courier Guy is loosely typed — different account
 * tiers return different field names (tracking_number vs trackingNumber vs
 * waybill_number). The mapping below accepts any of them.
 */

import type { Order, OrderItem } from "@/types";

const COURIER_GUY_API_BASE_URL = process.env.COURIER_GUY_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const COURIER_GUY_API_KEY = process.env.COURIER_GUY_API_KEY;
const COURIER_GUY_SENDER_NAME =
  process.env.COURIER_GUY_SENDER_NAME ?? "Charmistry";
const COURIER_GUY_SENDER_EMAIL = process.env.COURIER_GUY_SENDER_EMAIL ?? "";
const COURIER_GUY_SENDER_PHONE = process.env.COURIER_GUY_SENDER_PHONE ?? "";
const COURIER_GUY_SENDER_ADDRESS_LINE1 =
  process.env.COURIER_GUY_SENDER_ADDRESS_LINE1 ?? "";
const COURIER_GUY_SENDER_ADDRESS_LINE2 =
  process.env.COURIER_GUY_SENDER_ADDRESS_LINE2 ?? "";
const COURIER_GUY_SENDER_CITY = process.env.COURIER_GUY_SENDER_CITY ?? "";
const COURIER_GUY_SENDER_POSTAL_CODE =
  process.env.COURIER_GUY_SENDER_POSTAL_CODE ?? "";
const COURIER_GUY_SENDER_COUNTRY =
  process.env.COURIER_GUY_SENDER_COUNTRY ?? "ZA";

export interface CourierGuyShipmentResult {
  trackingNumber: string;
  waybillNumber: string | null;
  trackingUrl: string | null;
  status: "created" | "shipped";
  courier: string;
}

export function isCourierGuyConfigured(): boolean {
  return Boolean(COURIER_GUY_API_BASE_URL && COURIER_GUY_API_KEY);
}

export async function createCourierGuyShipment(
  order: Order,
  items: OrderItem[],
): Promise<CourierGuyShipmentResult> {
  if (!COURIER_GUY_API_BASE_URL || !COURIER_GUY_API_KEY) {
    throw new Error("Courier Guy is not configured");
  }

  const url = `${COURIER_GUY_API_BASE_URL}/shipments`;
  const payload = {
    reference: order.id,
    sender: {
      name: COURIER_GUY_SENDER_NAME,
      email: COURIER_GUY_SENDER_EMAIL,
      phone: COURIER_GUY_SENDER_PHONE,
      address_line1: COURIER_GUY_SENDER_ADDRESS_LINE1,
      address_line2: COURIER_GUY_SENDER_ADDRESS_LINE2,
      city: COURIER_GUY_SENDER_CITY,
      postal_code: COURIER_GUY_SENDER_POSTAL_CODE,
      country: COURIER_GUY_SENDER_COUNTRY,
    },
    recipient: {
      name: `${order.first_name} ${order.last_name}`,
      email: order.email,
      phone: order.phone ?? "",
      address_line1: order.shipping_address_line1,
      address_line2: order.shipping_address_line2 ?? "",
      city: order.shipping_city,
      postal_code: order.shipping_postal_code,
      country: order.shipping_country,
    },
    parcels: items.map((item) => ({
      description: item.product_name,
      quantity: item.quantity,
      // Weight is per-unit; courier multiplies by quantity at the carrier end.
      weight_kg: 0.5,
      // Total parcel weight for shipping providers that ignore `quantity`.
      total_weight_kg: Number((0.5 * item.quantity).toFixed(2)),
      value: Number(item.line_total),
    })),
    instructions: order.notes ? order.notes.trim() : undefined,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COURIER_GUY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `Courier Guy shipment request failed: ${response.status} ${response.statusText} - ${JSON.stringify(
        body,
      )}`,
    );
  }

  const trackingNumber =
    body?.tracking_number ??
    body?.trackingNumber ??
    body?.waybill_number ??
    body?.waybillNumber ??
    null;
  const trackingUrl =
    body?.tracking_url ??
    body?.trackingUrl ??
    body?.trackingLink ??
    body?.tracking_link ??
    null;
  const waybillNumber = body?.waybill_number ?? body?.waybillNumber ?? null;

  if (!trackingNumber && !trackingUrl) {
    throw new Error(
      `Courier Guy shipment response missing tracking details: ${JSON.stringify(
        body,
      )}`,
    );
  }

  return {
    trackingNumber: trackingNumber ?? "",
    waybillNumber,
    trackingUrl,
    status: trackingUrl ? "shipped" : "created",
    courier: "Courier Guy",
  };
}
