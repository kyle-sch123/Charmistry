/**
 * Internal admin dashboard — the hub linking to the fulfilment and catalogue
 * tools. Server shell only; noindex like the tools it links to (access is
 * gated by the ADMIN_FULFILMENT_KEY the underlying APIs require anyway).
 */

import type { Metadata } from "next";
import Link from "next/link";
import AdminNav from "./AdminNav";

export const metadata: Metadata = {
  title: "Admin | Charmistry",
  robots: { index: false, follow: false },
};

const TOOLS = [
  {
    href: "/admin/fulfil",
    title: "Fulfilment",
    description:
      "Mark paid orders as shipped. Recording a shipment fires the Klaviyo tracking email.",
  },
  {
    href: "/admin/catalogue",
    title: "Catalogue",
    description:
      "Edit prices, stock, sizes and descriptions; manage products, metal variants, photos and categories.",
  },
];

export default function AdminDashboardPage() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <AdminNav active="dashboard" />
        <header className="mb-10 border-b border-ink/10 pb-6">
          <h1 className="font-heading text-3xl text-ink uppercase tracking-wide">
            Dashboard
          </h1>
          <p className="mt-2 text-[13px] text-ink/55 font-body leading-relaxed">
            Internal tools for running the shop.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group border border-ink/10 bg-paper-warm/40 p-7 transition-colors hover:border-ink/25 hover:bg-paper-warm/70"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl text-ink uppercase tracking-wide">
                  {tool.title}
                </h2>
                <span
                  aria-hidden
                  className="text-ink/30 transition-all group-hover:translate-x-1 group-hover:text-gold"
                >
                  →
                </span>
              </div>
              <p className="mt-3 text-[13px] text-ink/55 font-body leading-relaxed">
                {tool.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
