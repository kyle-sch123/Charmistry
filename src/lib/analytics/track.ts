/**
 * The first-party analytics API that storefront components call.
 *
 * Why a thin wrapper: call sites already build a GA4-style item for GA, Meta
 * and Klaviyo; these helpers take that same item, so instrumenting a button is
 * one extra line next to the existing third-party calls (which stay exactly as
 * they were). Everything here is fire-and-forget and never throws.
 */

import type { AddToBagSource, EventName, EventProps } from "./events";
import { newId } from "./ids";
import * as tracker from "./tracker";
import { pageTypeFor } from "./url";

export interface TrackedItem {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
  slug?: string;
  image_url?: string | null;
  size?: string | null;
}

function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    // analytics must never break the shop
  }
}

function itemProps(item: TrackedItem) {
  return {
    product_id: item.item_id,
    product_slug: item.slug ?? null,
    name: item.item_name,
    variant: item.item_variant ?? null,
    size: item.size ?? null,
    category: item.item_category ?? null,
    price: Number(item.price) || 0,
    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
  };
}

export function track<N extends EventName>(name: N, props: EventProps[N]): void {
  safely(() => tracker.track(name, props));
}

/** One `add_to_cart` per item; items added together share a group id. */
export function trackAddToBag(items: TrackedItem[], opts: { source: AddToBagSource }): void {
  safely(() => {
    const groupId = items.length > 1 ? newId() : null;
    const list =
      opts.source === "card" && typeof window !== "undefined"
        ? pageTypeFor(window.location.pathname).pageType
        : null;
    for (const item of items) {
      tracker.track("add_to_cart", {
        ...itemProps(item),
        source: opts.source,
        list,
        group_id: groupId,
      });
    }
  });
}

export function trackRemoveFromBag(item: TrackedItem): void {
  safely(() => tracker.track("remove_from_cart", itemProps(item)));
}

export function trackProductView(item: TrackedItem): void {
  safely(() => tracker.track("view_item", itemProps(item)));
}

export function flushAnalytics(): void {
  safely(() => tracker.flush("manual"));
}

export function getCheckoutAttribution() {
  try {
    return tracker.getCheckoutAttribution();
  } catch {
    return null;
  }
}

export async function getKlaviyoFirstTouchProps(): Promise<Record<string, string> | null> {
  try {
    return await tracker.getKlaviyoFirstTouchProps();
  } catch {
    return null;
  }
}
