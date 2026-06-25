export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? "";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

function fb(...args: unknown[]) {
  if (!FB_PIXEL_ID || typeof window.fbq !== "function") return;
  window.fbq(...args);
}

export const pageview = () => {
  fb("track", "PageView");
};

// Shared item shape — intentionally identical to gtag.ts's GA4Item so each
// call site can build one object and hand it to both trackers.
interface PixelItem {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
}

// Maps our internal item shape onto Meta's content/contents params, shared by
// every commerce event. content_type "product" tags individual SKUs (vs
// "product_group" for variant parents). value is the event total in ZAR.
function contentParams(items: PixelItem[], value: number) {
  return {
    content_type: "product",
    content_ids: items.map((i) => i.item_id),
    contents: items.map((i) => ({
      id: i.item_id,
      quantity: i.quantity,
      item_price: i.price,
    })),
    currency: "ZAR",
    value,
  };
}

export function trackViewContent(item: PixelItem) {
  fb("track", "ViewContent", {
    ...contentParams([item], item.price),
    content_name: item.item_name,
    content_category: item.item_category,
  });
}

export function trackAddToCart(item: PixelItem) {
  fb("track", "AddToCart", {
    ...contentParams([item], item.price * item.quantity),
    content_name: item.item_name,
    content_category: item.item_category,
  });
}

export function trackInitiateCheckout(items: PixelItem[], value: number) {
  fb("track", "InitiateCheckout", {
    ...contentParams(items, value),
    num_items: items.reduce((n, i) => n + i.quantity, 0),
  });
}

export function trackSearch(searchTerm: string) {
  fb("track", "Search", { search_string: searchTerm });
}

export function trackPurchase(
  transactionId: string,
  items: PixelItem[],
  value: number,
) {
  fb("track", "Purchase", {
    ...contentParams(items, value),
    order_id: transactionId,
    num_items: items.reduce((n, i) => n + i.quantity, 0),
  });
}
