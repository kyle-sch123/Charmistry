/**
 * Injects the Google Analytics gtag script and fires a pageview on every
 * client-side route change. Renders null when NEXT_PUBLIC_GA_ID is unset.
 *
 * Two halves, deliberately split:
 *
 * 1. The `dataLayer`/`gtag` stub is a REGULAR inline <script>, so it exists in
 *    the server-rendered HTML and runs before hydration. That matters because
 *    `lib/gtag.ts` drops any event fired while `window.gtag` is undefined — with
 *    the stub inline, every call queues into `dataLayer` instead of vanishing.
 * 2. gtag.js itself loads `lazyOnload` (after window load, on idle). It costs
 *    ~240ms of main-thread time, which was landing squarely in the page's Total
 *    Blocking Time window. It drains whatever `dataLayer` has queued when it
 *    arrives, so nothing is lost by making it wait.
 */

"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { GA_TRACKING_ID, pageview } from "@/lib/gtag";

const scriptSrc = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;

const STUB = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('js', new Date());
gtag('config', '${GA_TRACKING_ID}', { page_path: window.location.pathname });
`;

export default function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!GA_TRACKING_ID) return;
    pageview(pathname);
  }, [pathname]);

  if (!GA_TRACKING_ID) return null;

  return (
    <>
      <script id="ga-init" dangerouslySetInnerHTML={{ __html: STUB }} />
      <Script src={scriptSrc} strategy="lazyOnload" id="ga-script" />
    </>
  );
}
