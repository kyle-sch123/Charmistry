/**
 * Admin shipping-price endpoint for the /admin/catalogue tool.
 *
 * Auth: `x-admin-key` == ADMIN_FULFILMENT_KEY. Service-role client (RLS on
 * shipping_rates is public-read, no write policies).
 *
 * GET   — every method with its live price and built-in default, plus
 *         `configured: false` when the shipping_rates table doesn't exist yet
 *         (migration 013 not applied) — prices are then the defaults and
 *         can't be saved.
 * PATCH — { prices: { [methodId]: number } } — set one or more methods' flat
 *         price. Validated by parseShippingPrice (above R0, at most
 *         MAX_SHIPPING_PRICE). Takes effect on the next checkout page load and
 *         is what /api/checkout charges from then on.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import { isAuthorized } from "@/lib/admin-auth";
import {
  SHIPPING_METHODS,
  isShippingMethodId,
  parseShippingPrice,
  ratesFromRows,
  type ShippingMethodId,
} from "@/lib/shipping";
import { isMissingTableError } from "@/lib/shipping-rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ServerSupabase = ReturnType<typeof createServerSupabase>;

/** The admin's view of every method — live price beside its default. */
async function readMethods(supabase: ServerSupabase) {
  const { data, error } = await supabase
    .from("shipping_rates")
    .select("method_id, price");

  const configured = !error;
  if (error && !isMissingTableError(error)) return { error };

  const rates = ratesFromRows(data);
  return {
    configured,
    methods: SHIPPING_METHODS.map((m) => ({
      id: m.id,
      label: m.label,
      carrier: m.carrier,
      eta: m.eta,
      price: rates[m.id],
      defaultPrice: m.price,
    })),
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await readMethods(createServerSupabase());
  if ("error" in result) {
    console.error("Admin shipping GET failed", result.error);
    return Response.json({ error: "service_error" }, { status: 500 });
  }
  return Response.json(result);
}

interface PatchBody {
  prices?: unknown;
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const prices = body.prices;
  if (typeof prices !== "object" || prices === null || Array.isArray(prices)) {
    return Response.json({ error: "prices_required" }, { status: 400 });
  }

  const rows: { method_id: ShippingMethodId; price: number; updated_at: string }[] =
    [];
  const now = new Date().toISOString();
  for (const [methodId, raw] of Object.entries(prices)) {
    if (!isShippingMethodId(methodId)) {
      return Response.json(
        { error: "unknown_method", method: methodId },
        { status: 400 },
      );
    }
    const price = parseShippingPrice(raw);
    if (price === null) {
      return Response.json(
        { error: "invalid_price", method: methodId },
        { status: 400 },
      );
    }
    rows.push({ method_id: methodId, price, updated_at: now });
  }
  if (rows.length === 0) {
    return Response.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("shipping_rates")
    .upsert(rows, { onConflict: "method_id" });
  if (error) {
    if (isMissingTableError(error)) {
      return Response.json({ error: "setup_required" }, { status: 503 });
    }
    console.error("Admin shipping PATCH failed", error);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  // Hand back what's now stored, so the panel shows the saved truth rather
  // than echoing its own draft.
  const result = await readMethods(supabase);
  if ("error" in result) {
    console.error("Admin shipping re-read failed", result.error);
    return Response.json({ ok: true });
  }
  return Response.json({ ok: true, ...result });
}
