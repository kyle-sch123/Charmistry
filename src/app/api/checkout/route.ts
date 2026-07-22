/**
 * Checkout API — validates the cart, prices it server-side, persists a
 * pending order, then either marks it paid (R0 total) or builds a signed
 * PayFast payment request for the browser to POST.
 *
 * Why it exists:
 * The client cannot be trusted for prices, stock, or discount value.
 * Every value used on the order row is recomputed from the products table
 * and the discounts RPC.
 *
 * Architecture:
 * - resolveDiscount() — read-only check; does NOT consume the code.
 * - orders insert — created in pending state (or paid for R0 totals).
 * - order_items insert — line totals are server-computed, not client-supplied.
 * - consumeDiscount() — RPC that conditionally increments uses_count; runs
 *   after order persistence so a failed insert doesn't burn a code.
 * - buildPaymentRequest() — PayFast call (signature build); refunds the
 *   discount on failure.
 *
 * Order of operations: ORDER MATTERS.
 *   1. Validate input -> 2. Fetch products -> 3. Compute totals
 *   -> 4. Insert order -> 5. Insert items -> 6. Consume discount
 *   -> 7. (Optional) Build PayFast payment request
 * Reordering 5 and 6 makes a failed item-insert leak a consumed discount.
 * Reordering 6 and 7 makes a failed payment-request build leak a consumed
 * discount AND a paid-but-not-paid-for order.
 *
 * Connects to:
 * - /api/payfast/notify — flips status from pending -> paid on ITN receipt.
 * - /checkout/success — the redirectUrl returned for R0 orders.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import { getVerifiedUser } from "@/lib/auth/server";
import { buildPaymentRequest } from "@/lib/payfast";
import { resolveShippingMethod, shippingCostForMethod } from "@/lib/shipping";
import {
  consumeDiscount,
  refundDiscount,
  resolveDiscount,
} from "@/lib/discounts";
import { resolveBundleDiscount } from "@/lib/bundles";
import { decrementProductStock } from "@/lib/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Hard caps so a hostile payload can't OOM the server or build a
// thousand-item PayFast form.
const MAX_LINE_QTY = 99;
const MAX_LINES = 50;

interface ClientCartLine {
  id: string;
  quantity: number;
}

interface CheckoutBody {
  customer?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    notes?: string;
  };
  lines?: ClientCartLine[];
  discountCode?: string;
  shippingMethod?: string;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Pull the category slug off a fetched product row. PostgREST returns the
 * embedded `categories` relation as a single object for a to-one FK, but tolerate
 * an array (some join shapes) and a missing/null relation → null.
 */
function categorySlugOf(product: {
  categories?: { slug?: string | null } | { slug?: string | null }[] | null;
}): string | null {
  const rel = product.categories;
  if (!rel) return null;
  const row = Array.isArray(rel) ? rel[0] : rel;
  return row?.slug ?? null;
}

function required(field: string, value: string, errors: string[]): string {
  if (!value) errors.push(`${field} is required`);
  return value;
}

function getSiteUrl(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (envUrl) return envUrl;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const errors: string[] = [];

  const customer = body.customer ?? {};
  const email = required("Email", str(customer.email).toLowerCase(), errors);
  if (email && !EMAIL_RE.test(email)) errors.push("Email is invalid");
  const firstName = required("First name", str(customer.firstName), errors);
  const lastName = required("Last name", str(customer.lastName), errors);
  const phone = str(customer.phone);
  const addressLine1 = required("Address", str(customer.addressLine1), errors);
  const addressLine2 = str(customer.addressLine2);
  const city = required("City", str(customer.city), errors);
  const postalCode = required("Postal code", str(customer.postalCode), errors);
  const country = str(customer.country) || "ZA";
  const notes = str(customer.notes).slice(0, 500);

  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  if (rawLines.length === 0) errors.push("Cart is empty");
  if (rawLines.length > MAX_LINES) errors.push("Too many items in cart");

  // Normalize and dedupe cart lines by product id
  const lineMap = new Map<string, number>();
  for (const raw of rawLines) {
    const id = str(raw?.id);
    const qty = Math.floor(Number(raw?.quantity ?? 0));
    if (!id || !Number.isFinite(qty) || qty < 1) continue;
    if (qty > MAX_LINE_QTY) {
      errors.push("Quantity exceeds limit");
      continue;
    }
    lineMap.set(id, (lineMap.get(id) ?? 0) + qty);
  }

  if (lineMap.size === 0 && errors.length === 0) {
    errors.push("Cart is empty");
  }

  if (errors.length > 0) {
    return Response.json(
      { error: "validation_failed", details: errors },
      { status: 400 },
    );
  }

  const productIds = Array.from(lineMap.keys());
  const supabase = createServerSupabase();

  // Fetch authoritative product data. Never trust client prices. The category
  // slug rides along so cart-aware category stacks (e.g. the rings Stack & Save)
  // are priced from server data, not anything the client asserted.
  const { data: products, error: fetchError } = await supabase
    .from("products")
    .select("id, name, slug, price, image_url, in_stock, quantity, categories(slug)")
    .in("id", productIds);

  if (fetchError) {
    console.error("Checkout: product fetch failed", fetchError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  if (!products || products.length !== productIds.length) {
    return Response.json({ error: "product_unavailable" }, { status: 409 });
  }

  // Build line items with server-side prices and stock check.
  const orderLines: {
    product_id: string;
    product_name: string;
    product_slug: string;
    product_image_url: string | null;
    /** Category slug — server-only, used to resolve category stacks. Not persisted. */
    category: string | null;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[] = [];

  let subtotal = 0;
  for (const product of products) {
    const qty = lineMap.get(product.id) ?? 0;
    if (!product.in_stock) {
      return Response.json(
        { error: "out_of_stock", product: product.name },
        { status: 409 },
      );
    }
    const available = Number(product.quantity ?? 0);
    // Reject whenever stock can't cover the requested qty. `available <= 0`
    // means the row is depleted even though `in_stock` is still true (a stale
    // flag we can't trust on its own).
    if (available <= 0 || qty > available) {
      return Response.json(
        { error: "insufficient_stock", product: product.name, available },
        { status: 409 },
      );
    }
    const unitPrice = Number(product.price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return Response.json(
        { error: "invalid_price", product: product.name },
        { status: 500 },
      );
    }
    const lineTotal = Number((unitPrice * qty).toFixed(2));
    subtotal += lineTotal;
    orderLines.push({
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      product_image_url: product.image_url,
      category: categorySlugOf(product),
      unit_price: unitPrice,
      quantity: qty,
      line_total: lineTotal,
    });
  }

  subtotal = Number(subtotal.toFixed(2));

  // Resolve the discount BEFORE shipping — free shipping is judged on the
  // discounted merchandise total, so the shipping cost depends on the discount.
  // Two mutually-exclusive sources, bundle wins:
  //
  //   1. Cart-aware bundle/stack (Everyday Edit, rings Stack & Save) — detected
  //      from the line items, not a typed code. Automatic and impossible to
  //      apply to unrelated products because it's keyed to specific slugs /
  //      categories. Not a discount_codes row, so there's nothing to
  //      consume/refund (discountCodeId stays null).
  //   2. A typed discount code — only honoured when no bundle applies, so a
  //      code can't be stacked on top of an already-discounted edit.
  //
  // Consumption of a typed code happens after order insert so a failed insert
  // doesn't permanently consume it.
  let discountAmount = 0;
  let discountCodeText: string | null = null;
  let discountCodeId: string | null = null;

  const bundle = resolveBundleDiscount(
    orderLines.map((l) => ({
      slug: l.product_slug,
      category: l.category,
      price: l.unit_price,
      quantity: l.quantity,
    })),
  );

  if (bundle) {
    discountAmount = Number(Math.min(bundle.amount, subtotal).toFixed(2));
    discountCodeText = bundle.code;
  } else {
    const rawDiscount =
      typeof body.discountCode === "string" ? body.discountCode.trim() : "";
    if (rawDiscount) {
      const resolved = await resolveDiscount(
        supabase,
        rawDiscount,
        subtotal,
        email,
      );
      if (typeof resolved === "string") {
        return Response.json(
          { error: "discount_invalid", reason: resolved },
          { status: 400 },
        );
      }
      discountAmount = resolved.amount;
      discountCodeText = resolved.code.code;
      discountCodeId = resolved.code.id;
    }
  }

  // Merchandise total the customer actually pays. The free-shipping threshold is
  // applied to THIS, not the pre-discount subtotal, so the amount shown in the
  // bag / checkout matches what's charged here.
  const discountedSubtotal = Number(
    Math.max(0, subtotal - discountAmount).toFixed(2),
  );

  // Resolve the chosen carrier. An unknown (tampered) id is rejected outright;
  // the cost is re-derived server-side so the client can never assert a price.
  const shippingMethodDef = resolveShippingMethod(body.shippingMethod);
  if (!shippingMethodDef) {
    return Response.json({ error: "invalid_shipping_method" }, { status: 400 });
  }
  const shippingCost = shippingCostForMethod(
    shippingMethodDef.id,
    discountedSubtotal,
  );

  const total = Number((discountedSubtotal + shippingCost).toFixed(2));

  if (total < 0) {
    return Response.json({ error: "invalid_total" }, { status: 400 });
  }

  // Attach the signed-in customer, if any. The id comes from the verified
  // session cookie — never from the request body — and getVerifiedUser()
  // returns null on any failure, so an auth outage can't block guest checkout.
  const authUser = await getVerifiedUser();

  // Create the order. If total is zero (e.g. 100%-off welcome code), mark it
  // paid immediately and skip PayFast — PayFast rejects R0 transactions.
  const isZeroTotal = total === 0;
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      email,
      user_id: authUser?.id ?? null,
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      shipping_address_line1: addressLine1,
      shipping_address_line2: addressLine2 || null,
      shipping_city: city,
      shipping_postal_code: postalCode,
      shipping_country: country,
      subtotal,
      shipping_cost: shippingCost,
      shipping_method: shippingMethodDef.id,
      discount_code: discountCodeText,
      discount_amount: discountAmount,
      total,
      currency: "ZAR",
      status: isZeroTotal ? "paid" : "pending",
      paid_at: isZeroTotal ? new Date().toISOString() : null,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("Checkout: order insert failed", orderError);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    orderLines.map((l) => ({
      order_id: order.id,
      product_id: l.product_id,
      product_name: l.product_name,
      product_slug: l.product_slug,
      product_image_url: l.product_image_url,
      unit_price: l.unit_price,
      quantity: l.quantity,
      line_total: l.line_total,
    })),
  );

  if (itemsError) {
    console.error("Checkout: order_items insert failed", itemsError);
    // Roll back the order so we don't leave orphans
    await supabase.from("orders").delete().eq("id", order.id);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  // Now that the order + items are persisted, consume the discount. Discount
  // RPC is conditional; if it fails (concurrent exhaustion), we fail the order.
  if (discountCodeId) {
    const consumed = await consumeDiscount(supabase, discountCodeId);
    if (!consumed) {
      await supabase.from("order_items").delete().eq("order_id", order.id);
      await supabase.from("orders").delete().eq("id", order.id);
      return Response.json(
        { error: "discount_invalid", reason: "max_uses_reached" },
        { status: 400 },
      );
    }
  }

  // Zero-total orders are done — no payment provider call needed. They are
  // created paid (no ITN will ever fire), so decrement stock here, once.
  if (isZeroTotal) {
    await decrementProductStock(
      supabase,
      orderLines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
    );
    return Response.json(
      {
        success: true,
        orderId: order.id,
        zeroTotal: true,
        redirectUrl: `${getSiteUrl(request)}/checkout/success?order=${order.id}`,
      },
      { status: 200 },
    );
  }

  // Build the PayFast payment request. PayFast looks the order back up
  // in the ITN handler via the `m_payment_id` form field (= order.id).
  const siteUrl = getSiteUrl(request);
  const itemName =
    orderLines.length === 1
      ? orderLines[0].product_name
      : `${orderLines[0].product_name} +${orderLines.length - 1} more`;

  let paymentRequest;
  try {
    paymentRequest = buildPaymentRequest({
      orderId: order.id,
      amountZar: total,
      email,
      firstName,
      lastName,
      phone,
      itemName,
      itemDescription: `Charmistry order ${order.id.slice(0, 8).toUpperCase()}`,
      returnUrl: `${siteUrl}/checkout/success?order=${order.id}`,
      cancelUrl: `${siteUrl}/checkout/cancelled?order=${order.id}`,
      notifyUrl: `${siteUrl}/api/payfast/notify`,
    });
  } catch (err) {
    console.error("Checkout: PayFast payment-request build failed", err);
    // Refund the consumed discount and mark the order failed.
    if (discountCodeId) await refundDiscount(supabase, discountCodeId);
    await supabase
      .from("orders")
      .update({ status: "failed" })
      .eq("id", order.id);
    return Response.json({ error: "payment_misconfigured" }, { status: 500 });
  }

  // No reference is known yet — PayFast emits its `pf_payment_id` only on
  // the ITN. `payfast_payment_id` stores our own `m_payment_id` (the order
  // id), which lets the merchant team trace by short-id if the ITN hasn't
  // landed yet.
  await supabase
    .from("orders")
    .update({ payfast_payment_id: order.id })
    .eq("id", order.id);

  return Response.json(
    {
      success: true,
      orderId: order.id,
      paymentUrl: paymentRequest.paymentUrl,
      formData: paymentRequest.formData,
    },
    { status: 200 },
  );
}
