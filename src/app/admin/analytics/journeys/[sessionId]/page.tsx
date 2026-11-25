/**
 * /admin/analytics/journeys/[sessionId]: one visit in full. Server shell
 * (noindex, admin nav); the client fetches the journey behind the admin key.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import AdminNav from "../../../AdminNav";
import { ui } from "../../ui";
import JourneyDetailClient from "./JourneyDetailClient";

export const metadata: Metadata = {
  title: "Visit | Charmistry admin",
  robots: { index: false, follow: false },
};

export default async function JourneyDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return (
    <main className={ui.main}>
      <div className={ui.shell}>
        <AdminNav active="analytics" />
        <Suspense fallback={null}>
          <JourneyDetailClient sessionId={sessionId} />
        </Suspense>
      </div>
    </main>
  );
}
