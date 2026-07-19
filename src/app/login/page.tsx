/**
 * Sign-in page — Google OAuth + passwordless email (one-time code with a
 * signed link fallback in the same email). No passwords anywhere.
 *
 * Middleware bounces already-signed-in visitors to /account (or ?next),
 * so this page only ever renders for signed-out users. ?next is sanitised
 * before it flows into the client so it can't become an open redirect.
 */

import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign in | Charmistry",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper text-ink pt-32 pb-24">
        <div className="max-w-md mx-auto px-6 md:px-8">
          <div className="text-center mb-10">
            <p className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body mb-4">
              Account
            </p>
            <h1 className="font-heading text-5xl font-light leading-[0.95] mb-4">
              Sign in
            </h1>
            <p className="text-ink/60 text-sm leading-relaxed">
              Track your orders, save your details, and keep a wishlist of the
              pieces you love.
            </p>
          </div>
          <LoginClient
            next={sanitizeNextPath(next)}
            initialError={error ?? null}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
