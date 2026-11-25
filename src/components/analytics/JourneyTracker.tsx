/**
 * Mounts the first-party journey tracker (src/lib/analytics/tracker.ts).
 *
 * Why this shape: it only needs the pathname (stored paths never carry a
 * query string), so it uses `usePathname()` and no Suspense boundary. The
 * first page view starts synchronously from local storage; the listeners
 * (engagement, scroll, flush on hide) attach once the browser is idle, so the
 * tracker never competes with the storefront's first paint.
 */

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pageView, start } from "@/lib/analytics/tracker";

export default function JourneyTracker() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      pageView();
    } catch {
      // analytics must never break the shop
    }
  }, [pathname]);

  useEffect(() => {
    const run = () => {
      try {
        start();
      } catch {
        // ignore
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(run, 1500);
    return () => clearTimeout(t);
  }, []);

  return null;
}
