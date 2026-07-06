/**
 * Internal fulfilment console. Server shell only — the tool itself is the
 * client component. noindex: this page must never appear in search results
 * (access is gated by the ADMIN_FULFILMENT_KEY the API requires anyway).
 */

import type { Metadata } from "next";
import FulfilClient from "./FulfilClient";

export const metadata: Metadata = {
  title: "Fulfilment | Charmistry",
  robots: { index: false, follow: false },
};

export default function FulfilPage() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <header className="mb-10 border-b border-ink/10 pb-6">
          <p className="text-[10px] tracking-[0.3em] uppercase text-ink/45 font-body mb-2">
            Charmistry · Internal
          </p>
          <h1 className="font-heading text-3xl text-ink uppercase tracking-wide">
            Fulfilment
          </h1>
          <p className="mt-2 text-[13px] text-ink/55 font-body leading-relaxed">
            Mark paid orders as shipped. Recording a shipment updates the order
            and fires the Klaviyo “Fulfilled Order” event that sends the
            customer their tracking email.
          </p>
        </header>
        <FulfilClient />
      </div>
    </main>
  );
}
