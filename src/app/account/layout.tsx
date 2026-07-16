/**
 * Account area frame — every /account page renders inside this.
 *
 * Auth: middleware already bounces signed-out visitors to /login, but the
 * getVerifiedUser() check here is deliberate defence-in-depth (and what makes
 * `user` available for the bootstrap call). ensureProfileAndClaimOrders is
 * idempotent and runs on every account visit — it is the safety net that
 * links past guest orders for users who signed in via the client-side OTP
 * path, which never passes through /auth/callback.
 *
 * Pages below fetch their own data with the user-scoped SSR client so RLS,
 * not page code, decides what a customer can see.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getVerifiedUser } from "@/lib/auth/server";
import { ensureProfileAndClaimOrders } from "@/lib/account";
import AccountNav from "./AccountNav";

export const metadata: Metadata = {
  title: "My Account | Charmistry",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getVerifiedUser();
  if (!user) redirect("/login?next=/account");

  await ensureProfileAndClaimOrders(user);

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper text-ink pt-32 pb-24">
        <div className="max-w-5xl mx-auto px-6 md:px-8">
          <header className="mb-10 md:mb-14">
            <p className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body mb-3">
              My Account
            </p>
            <h1 className="font-heading text-4xl md:text-5xl font-light leading-[0.95]">
              Your Charmistry.
            </h1>
          </header>
          <div className="md:grid md:grid-cols-[180px_1fr] md:gap-12 lg:gap-16">
            <AccountNav />
            <div className="min-w-0 mt-8 md:mt-0">{children}</div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
