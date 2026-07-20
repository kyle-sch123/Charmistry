/**
 * Internal catalogue manager. Server shell only — the tool is the client
 * component. noindex: this page must never appear in search results (access is
 * gated by the ADMIN_FULFILMENT_KEY the API requires anyway).
 */

import type { Metadata } from "next";
import AdminNav from "../AdminNav";
import CatalogueClient from "./CatalogueClient";

export const metadata: Metadata = {
  title: "Catalogue | Charmistry",
  robots: { index: false, follow: false },
};

export default function CataloguePage() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <AdminNav active="catalogue" />
        <header className="mb-10 border-b border-ink/10 pb-6">
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
