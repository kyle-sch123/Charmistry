import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CheckoutClient from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout | Charmistry",
  description: "Complete your Charmistry order securely through Paystack.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper text-ink pt-28 pb-24">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <header className="mb-12 text-center">
            <p className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body mb-4">
              Secure Checkout
            </p>
            <h1 className="font-heading text-5xl md:text-6xl font-light leading-[0.95]">
              Checkout
            </h1>
            <p className="mt-5 max-w-xl mx-auto text-ink/60 text-sm">
              Your payment is processed securely by Paystack. We never see your card details.
            </p>
          </header>
          <CheckoutClient />
        </div>
      </main>
      <Footer />
    </>
  );
}
