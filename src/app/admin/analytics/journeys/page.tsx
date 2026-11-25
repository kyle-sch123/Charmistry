/**
 * /admin/analytics/journeys: the list of visits. Server shell (noindex, admin
 * nav); JourneysClient reads its filters from the URL, so it sits under
 * Suspense.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import AdminNav from "../../AdminNav";
import { ui } from "../ui";
import JourneysClient from "./JourneysClient";

export const metadata: Metadata = {
  title: "Journeys | Charmistry admin",
  robots: { index: false, follow: false },
};

export default function JourneysPage() {
  return (
    <main className={ui.main}>
      <div className={ui.shell}>
        <AdminNav active="analytics" />
        <Suspense fallback={null}>
          <JourneysClient />
        </Suspense>
      </div>
    </main>
  );
}
