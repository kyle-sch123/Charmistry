/**
 * Google Analytics helpers — pageview and event emission.
 *
 * Both functions are no-ops when GA_TRACKING_ID is empty (env var not set)
 * or when window.gtag isn't loaded yet, so it's safe to call from anywhere
 * client-side without guarding. The script tag itself is injected by
 * src/components/analytics/GoogleAnalytics.tsx.
 */

export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

declare global {
  interface Window {
    dataLayer?: Array<unknown>;
    gtag?: (...args: unknown[]) => void;
  }
}

export const pageview = (url: string) => {
  if (!GA_TRACKING_ID || typeof window.gtag !== "function") return;

  window.gtag("config", GA_TRACKING_ID, {
    page_path: url,
  });
};

export const event = ({
  action,
  category,
  label,
  value,
}: {
  action: string;
  category: string;
  label: string;
  value?: number;
}) => {
  if (!GA_TRACKING_ID || typeof window.gtag !== "function") return;

  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value,
  });
};
