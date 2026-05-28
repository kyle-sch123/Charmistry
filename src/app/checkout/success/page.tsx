/**
 * Order success page. The webhook is the source of truth for payment
 * state — this page is purely UX, it does NOT confirm anything happened.
 * Without an ?order param the page shows a generic landing message.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SuccessClient from "./SuccessClient";

export const metadata: Metadata = {
  title: "Order confirmed | Charmistry",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage(
  { searchParams }: { searchParams: Promise<{ order?: string }> },
) {
  const { order } = await searchParams;
  const shortId = order ? order.slice(0, 8).toUpperCase() : null;
  const hasOrder = Boolean(order);

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper text-ink pt-28 pb-24">
        <div className="max-w-xl mx-auto px-6 md:px-8 text-center">
          <SuccessClient />
          <div className="w-16 h-16 mx-auto rounded-full border border-ink/20 flex items-center justify-center mb-8">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body mb-4">
            {hasOrder ? "Thank You" : "Charmistry"}
          </p>
          <h1 className="font-heading text-5xl md:text-6xl font-light leading-[0.95] mb-6">
            {hasOrder ? "Order placed." : "Nothing to see here."}
          </h1>
          <p className="text-ink/60 text-sm leading-relaxed mb-2">
            {hasOrder
              ? "Your payment was received and your pieces are being prepared with care. A confirmation email is on its way."
              : "This page confirms completed orders. Browse the collection to start a new order."}
          </p>
          {shortId && (
            <p className="text-[11px] tracking-[0.2em] uppercase text-ink/55 font-body mt-6">
              Order #{shortId}
            </p>
          )}
          <div className="mt-12">
            <Link
              href="/shop"
              className="inline-block px-10 py-4 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors"
            >
              {hasOrder ? "Continue Shopping" : "Browse the Collection"}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
