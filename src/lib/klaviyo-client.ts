/**
 * Client-side Klaviyo onsite tracking helpers.
 *
 * The onsite klaviyo.js snippet (components/analytics/Klaviyo.tsx) exposes
 * `window.klaviyo` as a queue/Proxy. These helpers push the ecommerce events
 * from Klaviyo's integration guide onto it so they attach to the visitor's
 * Klaviyo profile:
 *   - identify         (sets $email so subsequent events have a profile to
 *                       hang off — powers abandoned-cart / browse flows)
 *   - Viewed Product
 *   - Added to Cart
 *   - Started Checkout
 *
 * Each call is a no-op on the server and harmless before klaviyo.js has loaded:
 * pushes queue on the array and drain once the script initialises. Server-side
 * marketing events ("Placed Order", "Ordered Product") live in lib/klaviyo.ts.
 *
 * The KlaviyoItem input shape is intentionally the SAME object the call sites
 * already build for gtag.ts / fpixel.ts, plus optional `slug` / `image_url`, so
 * one object can feed all three trackers (GA / Meta ignore the extra fields).
 */

import type { CartLine } from "@/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

declare global {
  interface Window {
    klaviyo?: unknown[];
  }
}

export interface KlaviyoItem {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
  slug?: string;
  image_url?: string | null;
}

// Push a single event array onto the onsite queue. The base snippet guarantees
// window.klaviyo exists, but we initialise defensively so a helper called before
// the script tag mounts still queues rather than throwing.
function klPush(args: unknown[]) {
  if (typeof window === "undefined") return;
  (window.klaviyo = window.klaviyo || []).push(args);
}

function productUrl(slug?: string): string | undefined {
  return slug && SITE_URL ? `${SITE_URL}/products/${slug}` : undefined;
}

function checkoutUrl(): string | undefined {
  return SITE_URL ? `${SITE_URL}/checkout` : undefined;
}

// Maps our shared item shape onto a Klaviyo line-item dictionary. undefined
// fields are dropped by JSON serialisation, so optional data is simply absent.
function toLineItem(item: KlaviyoItem) {
  return {
    ProductID: item.item_id,
    SKU: item.slug ?? item.item_id,
    ProductName: item.item_name,
    Quantity: item.quantity,
    ItemPrice: item.price,
    RowTotal: item.price * item.quantity,
    ProductURL: productUrl(item.slug),
    ImageURL: item.image_url ?? undefined,
    ProductCategories: item.item_category ? [item.item_category] : [],
    Metal: item.item_variant,
  };
}

/** Convert persisted cart lines into the shared KlaviyoItem shape. */
export function cartLinesToKlaviyoItems(lines: CartLine[]): KlaviyoItem[] {
  return lines.map((l) => ({
    item_id: l.id,
    item_name: l.name,
    item_variant: l.metal ?? undefined,
    price: l.price,
    quantity: l.quantity,
    slug: l.slug,
    image_url: l.image_url,
  }));
}

/**
 * Associate the current browser session with a profile by email. Required for
 * Started Checkout / Added to Cart to attach to a contact and drive flows.
 */
export function identifyKlaviyo(profile: {
  email: string;
  firstName?: string;
  lastName?: string;
}) {
  if (!profile.email) return;
  klPush([
    "identify",
    {
      $email: profile.email,
      $first_name: profile.firstName,
      $last_name: profile.lastName,
    },
  ]);
}

export function trackViewedProduct(item: KlaviyoItem) {
  klPush([
    "track",
    "Viewed Product",
    {
      ProductID: item.item_id,
      SKU: item.slug ?? item.item_id,
      ProductName: item.item_name,
      Categories: item.item_category ? [item.item_category] : [],
      ImageURL: item.image_url ?? undefined,
      URL: productUrl(item.slug),
      Price: item.price,
      Metal: item.item_variant,
    },
  ]);
}

export function trackAddedToCart(
  addedItem: KlaviyoItem,
  cartItems: KlaviyoItem[],
  cartValue: number,
) {
  klPush([
    "track",
    "Added to Cart",
    {
      $value: cartValue,
      AddedItemProductID: addedItem.item_id,
      AddedItemProductName: addedItem.item_name,
      AddedItemSKU: addedItem.slug ?? addedItem.item_id,
      AddedItemCategories: addedItem.item_category
        ? [addedItem.item_category]
        : [],
      AddedItemImageURL: addedItem.image_url ?? undefined,
      AddedItemURL: productUrl(addedItem.slug),
      AddedItemPrice: addedItem.price,
      AddedItemQuantity: addedItem.quantity,
      ItemNames: cartItems.map((i) => i.item_name),
      CheckoutURL: checkoutUrl(),
      Items: cartItems.map(toLineItem),
    },
  ]);
}

export function trackStartedCheckout(
  items: KlaviyoItem[],
  value: number,
  opts: { email?: string; eventId?: string },
) {
  klPush([
    "track",
    "Started Checkout",
    {
      // $event_id dedupes repeat fires of the same checkout; the cart identifier
      // keeps it stable, the email scopes it per profile.
      $event_id: opts.eventId ?? String(Date.now()),
      ...(opts.email ? { $email: opts.email } : {}),
      $value: value,
      ItemNames: items.map((i) => i.item_name),
      CheckoutURL: checkoutUrl(),
      Categories: Array.from(
        new Set(
          items.flatMap((i) => (i.item_category ? [i.item_category] : [])),
        ),
      ),
      Items: items.map(toLineItem),
    },
  ]);
}
