/**
 * Order history — newest first, with item thumbnails and status chips. RLS
 * (orders_own_select / order_items_own_select) scopes both queries to the
 * signed-in user; guest orders only appear once claimed by the account
 * layout's bootstrap.
 */

import Link from "next/link";
import Image from "next/image";
import { createAuthServerClient } from "@/lib/auth/server";
import { formatPrice } from "@/lib/utils";
import type { Order, OrderItem } from "@/types";
import {
  PaymentChip,
  ShippingChip,
  formatOrderDate,
  shortOrderId,
} from "../order-ui";

export const dynamic = "force-dynamic";

type OrderRow = Pick<
  Order,
  "id" | "created_at" | "total" | "status" | "shipping_status"
>;
type ItemThumb = Pick<
  OrderItem,
  "order_id" | "product_name" | "product_image_url" | "quantity"
>;

export default async function AccountOrdersPage() {
  const supabase = await createAuthServerClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, created_at, total, status, shipping_status")
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: items } = orderIds.length
    ? await supabase
        .from("order_items")
        .select("order_id, product_name, product_image_url, quantity")
        .in("order_id", orderIds)
        .returns<ItemThumb[]>()
    : { data: [] as ItemThumb[] };

  const itemsByOrder = new Map<string, ItemThumb[]>();
  for (const item of items ?? []) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="border border-ink/10 p-8 text-center">
        <p className="text-sm text-ink/60 leading-relaxed mb-6">
          No orders yet. When you place one — signed in or with this email as a
          guest — it will show up here.
        </p>
        <Link
          href="/shop"
          className="inline-block px-8 py-3 bg-ink text-paper text-[11px] tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors"
        >
          Browse the Collection
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body">
        Order History
      </h2>
      <ul className="space-y-4">
        {orders.map((order) => {
          const orderItems = itemsByOrder.get(order.id) ?? [];
          const itemCount = orderItems.reduce((n, i) => n + i.quantity, 0);
          return (
            <li key={order.id}>
              <Link
                href={`/account/orders/${order.id}`}
                className="block border border-ink/10 hover:border-ink/40 transition-colors p-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="font-display text-lg">
                      Order #{shortOrderId(order.id)}
                    </p>
                    <p className="text-[11px] text-ink/45 font-body mt-1">
                      {formatOrderDate(order.created_at)} ·{" "}
                      {itemCount === 1 ? "1 item" : `${itemCount} items`}
                    </p>
                  </div>
                  <p className="font-display text-xl">
                    {formatPrice(Number(order.total))}
                  </p>
                </div>

                {orderItems.length > 0 && (
                  <div className="mt-4 flex gap-2">
                    {orderItems.slice(0, 4).map(
                      (item, i) =>
                        item.product_image_url && (
                          <div
                            key={`${order.id}-${i}`}
                            className="relative w-12 h-14 overflow-hidden bg-stone"
                          >
                            <Image
                              src={item.product_image_url}
                              alt={item.product_name}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                        ),
                    )}
                    {orderItems.length > 4 && (
                      <div className="w-12 h-14 border border-ink/10 flex items-center justify-center text-[11px] text-ink/45 font-body">
                        +{orderItems.length - 4}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <PaymentChip status={order.status} />
                  {order.status === "paid" && (
                    <ShippingChip status={order.shipping_status} />
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
