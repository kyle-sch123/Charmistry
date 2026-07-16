/**
 * Shared presentational helpers for the account order pages. Server-safe
 * (no hooks) — used by both the orders list and the order detail page.
 *
 * Wording is customer-facing: the internal shipping_status values `pending`
 * and `created` both read as "Preparing" (a label being created is not a
 * meaningful distinction to a shopper), and `failed` is a delivery issue to
 * contact us about, not a scary terminal state.
 */

import type { OrderStatus, ShippingStatus } from "@/types";
import { cn } from "@/lib/utils";

export const PAYMENT_LABELS: Record<OrderStatus, string> = {
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
  cancelled: "Cancelled",
};

export const SHIPPING_LABELS: Record<ShippingStatus, string> = {
  pending: "Preparing",
  created: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  failed: "Delivery issue",
};

export function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function shortOrderId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function PaymentChip({ status }: { status: OrderStatus }) {
  return (
    <Chip
      label={PAYMENT_LABELS[status]}
      tone={
        status === "paid" ? "solid" : status === "pending" ? "outline" : "muted"
      }
    />
  );
}

export function ShippingChip({ status }: { status: ShippingStatus }) {
  return (
    <Chip
      label={SHIPPING_LABELS[status]}
      tone={status === "delivered" ? "solid" : "outline"}
    />
  );
}

function Chip({
  label,
  tone,
}: {
  label: string;
  tone: "solid" | "outline" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-block px-2.5 py-1 text-[10px] tracking-[0.15em] uppercase font-body border",
        tone === "solid" && "bg-ink text-paper border-ink",
        tone === "outline" && "border-ink/25 text-ink/70",
        tone === "muted" && "border-ink/15 text-ink/40",
      )}
    >
      {label}
    </span>
  );
}
