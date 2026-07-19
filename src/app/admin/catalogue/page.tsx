/**
 * Internal catalogue manager. Server shell only — the tool is the client
 * component. noindex: this page must never appear in search results (access is
 * gated by the ADMIN_FULFILMENT_KEY the API requires anyway).
 */

import type { Metadata } from "next";
import Link from "next/link";
import CatalogueClient from "./CatalogueClient";

export const metadata: Metadata = {
  title: "Catalogue | Charmistry",
  robots: { index: false, follow: false },
};

export default function CataloguePage() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <header className="mb-10 border-b border-ink/10 pb-6">
          <div className="flex items-center justify-between">
            <p className="text-[10px] tracking-[0.3em] uppercase text-ink/45 font-body mb-2">
              Charmistry · Internal
            </p>
            <Link
              href="/admin/fulfil"
              className="text-[10px] tracking-[0.2em] uppercase text-ink/45 hover:text-ink transition-colors"
            >
              Fulfilment →
            </Link>
          </div>
          <h1 className="font-heading text-3xl text-ink uppercase tracking-wide">
            Catalogue
          </h1>
          <p className="mt-2 text-[13px] text-ink/55 font-body leading-relaxed">
            Edit prices, stock, sizes and descriptions; add or remove products
            and metal variants; upload product photos (auto-converted to WebP);
            and manage categories.
          </p>
        </header>
        <CatalogueClient />
      </div>
    </main>
  );
}
