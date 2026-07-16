/**
 * Order detail — items, delivery progress, tracking link, totals, address,
 * and "order again". The RLS policy is the access check: if the select
 * returns nothing, this order isn't the visitor's, and we 404 rather than
 * distinguish "not yours" from "doesn't exist".
 */

import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createAuthServerClient } from "@/lib/auth/server";
import { formatPrice } from "@/lib/utils";
import { shippingMethodLabel } from "@/lib/shipping";
import type { Order, OrderItem } from "@/types";
import {
  PaymentChip,
  formatOrderDate,
  shortOrderId,
  SHIPPING_LABELS,
} from "../../order-ui";
import BuyAgainButton from "./BuyAgainButton";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createAuthServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle<Order>();
  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", id)
    .returns<OrderItem[]>();
  const orderItems = items ?? [];

  const methodLabel = shippingMethodLabel(order.shipping_method);

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/account/orders"
          className="text-[11px] tracking-[0.15em] uppercase text-ink/45 hover:text-ink transition-colors font-body"
        >
          ← All orders
        </Link>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">
              Order #{shortOrderId(order.id)}
            </h2>
            <p className="text-[11px] text-ink/45 font-body mt-1">
              Placed {formatOrderDate(order.created_at)}
            </p>
          </div>
          <PaymentChip status={order.status} />
        </div>
      </div>

      {/* Delivery progress — only meaningful once the order is paid. */}
      {order.status === "paid" ? (
        <section className="border border-ink/10 p-6 space-y-6">
          <h3 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body">
            Delivery
          </h3>
          <DeliveryTimeline order={order} />
          {order.shipping_status === "failed" && (
            <p className="text-sm text-ink/60 leading-relaxed border-l border-ink/15 pl-4">
              There was an issue with this delivery. Please contact us at{" "}
              <a
                href="mailto:charmistryza@gmail.com"
                className="text-ink underline underline-offset-4"
              >
                charmistryza@gmail.com
              </a>{" "}
              and we&apos;ll sort it out.
            </p>
          )}
          {(order.tracking_number || order.courier) && (
            <div className="pt-2 border-t border-ink/10 grid sm:grid-cols-2 gap-4 text-sm">
              {order.courier && (
                <Detail label="Courier" value={order.courier} />
              )}
              {order.tracking_number && (
                <Detail label="Tracking number" value={order.tracking_number} />
              )}
              {order.shipped_at && (
                <Detail
                  label="Shipped on"
                  value={formatOrderDate(order.shipped_at)}
                />
              )}
              {methodLabel && (
                <Detail label="Delivery method" value={methodLabel} />
              )}
              {order.tracking_url && (
                <a
                  href={order.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sm:col-span-2 inline-block w-fit px-6 py-3 border border-ink text-[11px] tracking-[0.2em] uppercase font-body hover:bg-ink hover:text-paper transition-colors"
                >
                  Track your parcel ↗
                </a>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="border border-ink/10 p-6">
          <p className="text-sm text-ink/60 leading-relaxed">
            {order.status === "pending"
              ? "We're still waiting for payment confirmation on this order. If you completed payment, this usually updates within a few minutes."
              : "This order was not completed, so nothing will be shipped. Feel free to place a new order any time."}
          </p>
        </section>
      )}

      {/* Items */}
      <section className="space-y-4">
        <h3 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body">
          Items
        </h3>
        <ul className="divide-y divide-ink/10 border border-ink/10 px-6">
          {orderItems.map((item) => (
            <li key={item.id} className="flex gap-4 py-4">
              <div className="relative w-16 h-20 shrink-0 overflow-hidden bg-stone">
                {item.product_image_url && (
                  <Image
                    src={item.product_image_url}
                    alt={item.product_name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <Link
                  href={`/products/${item.product_slug}`}
                  className="font-display text-sm leading-snug hover:underline underline-offset-4"
                >
                  {item.product_name}
                </Link>
                <span className="text-[11px] text-ink/45 font-body">
                  Qty {item.quantity} · {formatPrice(Number(item.unit_price))}{" "}
                  each
                </span>
                <span className="mt-auto text-sm font-body">
                  {formatPrice(Number(item.line_total))}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <BuyAgainButton
          items={orderItems.map((i) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: i.quantity,
          }))}
        />
      </section>

      {/* Totals + address */}
      <div className="grid md:grid-cols-2 gap-6">
        <section className="border border-ink/10 p-6 space-y-2">
          <h3 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body mb-4">
            Summary
          </h3>
          <Row label="Subtotal" value={formatPrice(Number(order.subtotal))} />
          {Number(order.discount_amount) > 0 && (
            <Row
              label={`Discount${order.discount_code ? ` (${order.discount_code})` : ""}`}
              value={`−${formatPrice(Number(order.discount_amount))}`}
            />
          )}
          <Row
            label="Shipping"
            value={
              Number(order.shipping_cost) === 0
                ? "Free"
                : formatPrice(Number(order.shipping_cost))
            }
          />
          <div className="flex justify-between items-center pt-3 mt-3 border-t border-ink/15">
            <span className="text-[11px] tracking-[0.2em] uppercase font-body">
              Total
            </span>
            <span className="font-display text-2xl">
              {formatPrice(Number(order.total))}
            </span>
          </div>
        </section>

        <section className="border border-ink/10 p-6">
          <h3 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body mb-4">
            Shipping Address
          </h3>
          <address className="not-italic text-sm text-ink/70 leading-relaxed">
            {order.first_name} {order.last_name}
            <br />
            {order.shipping_address_line1}
            {order.shipping_address_line2 && (
              <>
                <br />
                {order.shipping_address_line2}
              </>
            )}
            <br />
            {order.shipping_city}, {order.shipping_postal_code}
            <br />
            {order.shipping_country}
          </address>
          {order.notes && (
            <p className="mt-4 pt-4 border-t border-ink/10 text-[11px] text-ink/45 leading-relaxed">
              <span className="block uppercase tracking-[0.15em] mb-1">
                Order notes
              </span>
              {order.notes}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Three-step progress: Preparing → Shipped → Delivered. `pending` and
 * `created` both sit at step 0 (see order-ui.tsx); `failed` freezes the bar
 * at whatever was reached — the note above explains the situation.
 */
function DeliveryTimeline({ order }: { order: Order }) {
  const steps = ["Preparing", "Shipped", "Delivered"] as const;
  const reached =
    order.shipping_status === "delivered"
      ? 2
      : order.shipping_status === "shipped"
        ? 1
        : 0;

  return (
    <div>
      <div className="flex items-center">
        {steps.map((step, i) => (
          <div
            key={step}
            className={i < steps.length - 1 ? "flex items-center flex-1" : "flex items-center"}
          >
            <span
              className={`h-3 w-3 rounded-full border shrink-0 ${
                i <= reached ? "bg-ink border-ink" : "border-ink/25 bg-paper"
              }`}
              aria-hidden
            />
            {i < steps.length - 1 && (
              <span
                className={`h-px flex-1 mx-2 ${
                  i < reached ? "bg-ink" : "bg-ink/15"
                }`}
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] tracking-[0.15em] uppercase font-body">
        {steps.map((step, i) => (
          <span key={step} className={i <= reached ? "text-ink" : "text-ink/35"}>
            {step}
          </span>
        ))}
      </div>
      <p className="sr-only">
        Current status: {SHIPPING_LABELS[order.shipping_status]}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.2em] uppercase text-ink/45 font-body mb-1">
        {label}
      </p>
      <p className="text-sm text-ink/80">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm text-ink/60">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
