import { createServerSupabase } from "@/lib/supabase-server";
import { buildCheckoutPayload } from "@/lib/payfast";
import { consumeDiscount, refundDiscount, resolveDiscount } from "@/lib/discounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
    return Response.json({ error: "validation_failed", details: errors }, { status: 400 });
  }

  const productIds = Array.from(lineMap.keys());
  const supabase = createServerSupabase();

  // Fetch authoritative product data. Never trust client prices.
  const { data: products, error: fetchError } = await supabase
    .from("products")
    .select("id, name, slug, price, image_url, in_stock, quantity")
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
    if (available > 0 && qty > available) {
      return Response.json(
        { error: "insufficient_stock", product: product.name, available },
        { status: 409 },
      );
    }
    const unitPrice = Number(product.price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return Response.json({ error: "invalid_price", product: product.name }, { status: 500 });
    }
    const lineTotal = Number((unitPrice * qty).toFixed(2));
    subtotal += lineTotal;
    orderLines.push({
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      product_image_url: product.image_url,
      unit_price: unitPrice,
      quantity: qty,
      line_total: lineTotal,
    });
  }

  subtotal = Number(subtotal.toFixed(2));
  const shippingCost = 0; // Free shipping for now

  // Resolve + atomically consume discount code server-side. Never trust the
  // client's claim about discount amount.
  let discountAmount = 0;
  let discountCodeText: string | null = null;
  let discountCodeId: string | null = null;
  const rawDiscount = typeof body.discountCode === "string" ? body.discountCode.trim() : "";
  if (rawDiscount) {
    const resolved = await resolveDiscount(supabase, rawDiscount, subtotal, email);
    if (typeof resolved === "string") {
      return Response.json({ error: "discount_invalid", reason: resolved }, { status: 400 });
    }
    const consumed = await consumeDiscount(supabase, resolved.code.id);
    if (!consumed) {
      return Response.json({ error: "discount_invalid", reason: "max_uses_reached" }, { status: 400 });
    }
    discountAmount = resolved.amount;
    discountCodeText = resolved.code.code;
    discountCodeId = resolved.code.id;
  }

  const total = Number(Math.max(0, subtotal + shippingCost - discountAmount).toFixed(2));

  if (total <= 0) {
    return Response.json({ error: "invalid_total" }, { status: 400 });
  }

  // Create the pending order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      email,
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
      discount_code: discountCodeText,
      discount_amount: discountAmount,
      total,
      currency: "ZAR",
      status: "pending",
      notes: notes || null,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("Checkout: order insert failed", orderError);
    if (discountCodeId) await refundDiscount(supabase, discountCodeId);
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
    if (discountCodeId) await refundDiscount(supabase, discountCodeId);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  // Build PayFast payload
  const siteUrl = getSiteUrl(request);
  const itemName = orderLines.length === 1
    ? orderLines[0].product_name
    : `Charmistry order (${orderLines.reduce((acc, l) => acc + l.quantity, 0)} items)`;

  let payload;
  try {
    payload = buildCheckoutPayload({
      orderId: order.id,
      amount: total,
      itemName,
      itemDescription: `Order #${order.id.slice(0, 8).toUpperCase()}`,
      firstName,
      lastName,
      email,
      cellNumber: phone || undefined,
      returnUrl: `${siteUrl}/checkout/success?order=${order.id}`,
      cancelUrl: `${siteUrl}/checkout/cancelled?order=${order.id}`,
      notifyUrl: `${siteUrl}/api/payfast/notify`,
    });
  } catch (err) {
    console.error("Checkout: PayFast payload build failed", err);
    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
    return Response.json({ error: "payment_misconfigured" }, { status: 500 });
  }

  return Response.json(
    {
      success: true,
      orderId: order.id,
      action: payload.action,
      fields: payload.fields,
    },
    { status: 200 },
  );
}
