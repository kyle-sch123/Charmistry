/**
 * /admin/analytics/links: the campaign link builder. Server shell (noindex,
 * admin nav). It needs no admin key: it only builds links locally and reads
 * no shop data.
 */

import type { Metadata } from "next";
import AdminNav from "../../AdminNav";
import { ui } from "../ui";
import LinkBuilderClient from "./LinkBuilderClient";

export const metadata: Metadata = {
  title: "Link builder | Charmistry admin",
  robots: { index: false, follow: false },
};

export default function LinkBuilderPage() {
  return (
    <main className={ui.main}>
      <div className={ui.shell}>
        <AdminNav active="analytics" />
        <LinkBuilderClient />
      </div>
    </main>
  );
}
