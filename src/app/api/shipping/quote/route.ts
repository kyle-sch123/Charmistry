/**
 * POST /api/shipping/quote — returns the shipping cost the checkout will
 * charge for a given destination + line set. Used by CheckoutClient to
 * render the live shipping total as the user fills in the address.
 *
 * The shipping cost on the order at /api/checkout is recomputed with the
 * same estimateShippingCost(), so the quote here is informational; we
 * never trust the client's claim about it.
 */

import { estimateShippingCost } from "@/lib/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ShippingQuoteRequest {
  destination?: {
    country?: string;
    city?: string;
    postalCode?: string;
  };
  lines?: { quantity?: number }[];
  subtotal?: number;
}

export async function POST(request: Request) {
  let body: ShippingQuoteRequest;
  try {
    body = (await request.json()) as ShippingQuoteRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const destination = {
    country: body.destination?.country?.trim() || "ZA",
    city: body.destination?.city?.trim() || "",
    postalCode: body.destination?.postalCode?.trim() || "",
  };

  if (!destination.city || !destination.postalCode) {
    return new Response(JSON.stringify({ error: "missing_destination" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const lines = Array.isArray(body.lines)
    ? body.lines
        .map((line) => ({ quantity: Number(line.quantity ?? 0) }))
        .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0)
    : [];

  if (lines.length === 0) {
    return new Response(JSON.stringify({ error: "missing_lines" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const subtotal = Number(body.subtotal ?? 0);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return new Response(JSON.stringify({ error: "invalid_subtotal" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const shippingCost = estimateShippingCost({
    lines,
    subtotal,
    destination,
  });

  return new Response(JSON.stringify({ shippingCost }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
