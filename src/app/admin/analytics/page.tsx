/**
 * /admin/analytics: the analytics overview. Server shell only (noindex, the
 * admin nav); the data and the admin-key gate live in OverviewClient, which
 * reads its filters from the URL and so sits under Suspense.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import AdminNav from "../AdminNav";
import OverviewClient from "./OverviewClient";
import { ui } from "./ui";

export const metadata: Metadata = {
  title: "Analytics | Charmistry admin",
  robots: { index: false, follow: false },
};

export default function AnalyticsOverviewPage() {
  return (
    <main className={ui.main}>
      <div className={ui.shell}>
        <AdminNav active="analytics" />
        <Suspense fallback={null}>
          <OverviewClient />
        </Suspense>
      </div>
    </main>
  );
}
