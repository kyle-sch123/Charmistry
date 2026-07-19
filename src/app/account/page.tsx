/**
 * Account overview — greeting, the most recent order at a glance, and quick
 * links into the rest of the account area. All reads run under RLS as the
 * signed-in user.
 */

import Link from "next/link";
import { createAuthServerClient } from "@/lib/auth/server";
import { formatPrice } from "@/lib/utils";
import type { Order, Profile } from "@/types";
import {
  PaymentChip,
  ShippingChip,
  formatOrderDate,
  shortOrderId,
} from "./order-ui";

export const dynamic = "force-dynamic";

type OrderSummary = Pick<
  Order,
  "id" | "created_at" | "total" | "status" | "shipping_status"
>;

export default async function AccountOverviewPage() {
  const supabase = await createAuthServerClient();

  const [{ data: profile }, ordersRes, wishlistRes] = await Promise.all([
    supabase.from("profiles").select("first_name").maybeSingle<Pick<Profile, "first_name">>(),
    supabase
      .from("orders")
      .select("id, created_at, total, status, shipping_status", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("wishlist_items")
      .select("product_id", { count: "exact", head: true }),
  ]);

  const latest = (ordersRes.data?.[0] as OrderSummary | undefined) ?? null;
  const orderCount = ordersRes.count ?? 0;
  const wishlistCount = wishlistRes.count ?? 0;

  return (
    <div className="space-y-12">
      <p className="text-ink/60 text-sm leading-relaxed">
        {profile?.first_name
          ? `Good to see you, ${profile.first_name}.`
          : "Good to see you."}{" "}
        Your orders, saved details, and wishlist all live here.
      </p>

      <section className="space-y-4">
        <h2 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body">
          Latest Order
        </h2>
        {latest ? (
          <Link
            href={`/account/orders/${latest.id}`}
            className="block border border-ink/10 hover:border-ink/40 transition-colors p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="font-display text-lg">
                  Order #{shortOrderId(latest.id)}
                </p>
                <p className="text-[11px] text-ink/45 font-body mt-1">
                  Placed {formatOrderDate(latest.created_at)}
                </p>
              </div>
              <p className="font-display text-xl">
                {formatPrice(Number(latest.total))}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <PaymentChip status={latest.status} />
              {latest.status === "paid" && (
                <ShippingChip status={latest.shipping_status} />
              )}
            </div>
          </Link>
        ) : (
          <div className="border border-ink/10 p-6">
            <p className="text-sm text-ink/60 leading-relaxed mb-4">
              You haven&apos;t placed an order yet — your history will appear
              here.
            </p>
            <Link
              href="/shop"
              className="inline-block px-8 py-3 bg-ink text-paper text-[11px] tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors"
            >
              Browse the Collection
            </Link>
          </div>
        )}
      </section>

      <section className="grid sm:grid-cols-3 gap-4">
        {[
          {
            href: "/account/orders",
            title: "Orders",
            note:
              orderCount === 1 ? "1 order" : `${orderCount} orders`,
          },
          {
            href: "/account/wishlist",
            title: "Wishlist",
            note:
              wishlistCount === 1
                ? "1 saved piece"
                : `${wishlistCount} saved pieces`,
          },
          {
            href: "/account/settings",
            title: "Settings",
            note: "Details & address",
          },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="border border-ink/10 hover:border-ink/40 transition-colors p-6"
          >
            <p className="font-display text-lg mb-1">{card.title}</p>
            <p className="text-[11px] text-ink/45 font-body">{card.note}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
