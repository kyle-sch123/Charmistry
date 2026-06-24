export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

declare global {
  interface Window {
    dataLayer?: Array<unknown>;
    gtag?: (...args: unknown[]) => void;
  }
}

function g(...args: unknown[]) {
  if (!GA_TRACKING_ID || typeof window.gtag !== "function") return;
  window.gtag(...args);
}

export const pageview = (url: string) => {
  g("config", GA_TRACKING_ID, { page_path: url });
};

interface GA4Item {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
}

export function trackAddToCart(item: GA4Item) {
  g("event", "add_to_cart", {
    currency: "ZAR",
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackRemoveFromCart(item: GA4Item) {
  g("event", "remove_from_cart", {
    currency: "ZAR",
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackViewItem(item: GA4Item) {
  g("event", "view_item", {
    currency: "ZAR",
    value: item.price,
    items: [item],
  });
}

export function trackBeginCheckout(items: GA4Item[], value: number) {
  g("event", "begin_checkout", {
    currency: "ZAR",
    value,
    items,
  });
}

export function trackPurchase(
  transactionId: string,
  items: GA4Item[],
  value: number,
  shipping?: number,
) {
  g("event", "purchase", {
    currency: "ZAR",
    transaction_id: transactionId,
    value,
    shipping: shipping ?? 0,
    items,
  });
}

export function trackSearch(searchTerm: string) {
  g("event", "search", { search_term: searchTerm });
}
