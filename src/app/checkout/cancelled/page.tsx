import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Payment cancelled | Charmistry",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function CheckoutCancelledPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper text-ink pt-28 pb-24">
        <div className="max-w-xl mx-auto px-6 md:px-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full border border-ink/20 flex items-center justify-center mb-8">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body mb-4">
            Payment Cancelled
          </p>
          <h1 className="font-heading text-5xl md:text-6xl font-light leading-[0.95] mb-6">
            No charge made.
          </h1>
          <p className="text-ink/60 text-sm leading-relaxed">
            Your order was not completed. Your bag is saved — you can try again whenever you&apos;re ready.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/checkout"
              className="inline-block px-10 py-4 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors"
            >
              Try Again
            </Link>
            <Link
              href="/shop"
              className="inline-block px-10 py-4 border border-ink/20 text-xs tracking-[0.2em] uppercase font-body hover:border-ink transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
