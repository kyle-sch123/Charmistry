/**
 * Analytics event names, their payloads and the checkout funnel steps.
 *
 * Why this exists: the tracker emits these events, the collect API validates
 * them, and the SQL in 014_analytics.sql reads them by name. One typed list
 * keeps all three in step (the SQL mirrors PASSIVE_EVENTS and the funnel).
 *
 * Privacy: no event carries an email, name or phone number.
 * `checkout_email_entered` records only that a valid email was entered, and
 * search terms that look like emails are replaced with "[email]" before they
 * leave the browser (and again on the server).
 */

import type { PageType } from "./types";

export const FUNNEL_STEPS = [
  "sessions",
  "viewed_product",
  "added_to_bag",
  "reached_checkout",
  "entered_email",
  "clicked_pay",
  "paid",
] as const;
export type FunnelStepKey = (typeof FUNNEL_STEPS)[number];

export type AddToBagSource =
  | "pdp"
  | "pdp_sticky"
  | "card"
  | "cart_suggestion"
  | "stack_builder"
  | "bundle";

export const ADD_TO_BAG_SOURCES: readonly AddToBagSource[] = [
  "pdp",
  "pdp_sticky",
  "card",
  "cart_suggestion",
  "stack_builder",
  "bundle",
];

export type PromoKey =
  | "rings_stack_banner"
  | "mix_stack_banner"
  | "stack_promo_banner";

export const PROMO_KEYS: readonly PromoKey[] = [
  "rings_stack_banner",
  "mix_stack_banner",
  "stack_promo_banner",
];

export interface ItemProps {
  product_id: string;
  product_slug: string | null;
  name: string;
  variant: string | null;
  size: string | null;
  category: string | null;
  price: number;
  quantity: number;
}

export interface EventProps {
  view_item: ItemProps;
  add_to_cart: ItemProps & {
    source: AddToBagSource;
    list: PageType | null;
    group_id: string | null;
  };
  remove_from_cart: ItemProps;
  view_cart: { item_count: number; value: number };
  begin_checkout: { item_count: number; value: number };
  /** never the email itself */
  checkout_email_entered: Record<string, never>;
  shipping_method_selected: { method: string };
  discount_applied: { code: string; kind: "welcome" | "code"; amount: number };
  discount_rejected: { reason: string; kind: "welcome" | "code" };
  checkout_submitted: {
    value: number;
    item_count: number;
    method: string;
    promo: string | null;
  };
  checkout_error: { reason: string };
  purchase_confirmed: { order_id: string; value: number };
  /** emails in terms become "[email]" */
  search: { term: string; results: number };
  promo_click: { promo: PromoKey };
  newsletter_signup: { outcome: "success" | "duplicate" | "error" };
  wishlist_add: { product_id: string };
  wishlist_remove: { product_id: string };
  review_submitted: { product_id: string; rating: number };
}

export type EventName = keyof EventProps;

export interface EventPayload<N extends EventName = EventName> {
  id: string;
  name: N;
  at: string;
  pageViewId: string | null;
  props: EventProps[N];
}

export type AnyEventPayload = { [N in EventName]: EventPayload<N> }[EventName];

/** Every event name, in declaration order. */
export const EVENT_NAMES: readonly EventName[] = [
  "view_item",
  "add_to_cart",
  "remove_from_cart",
  "view_cart",
  "begin_checkout",
  "checkout_email_entered",
  "shipping_method_selected",
  "discount_applied",
  "discount_rejected",
  "checkout_submitted",
  "checkout_error",
  "purchase_confirmed",
  "search",
  "promo_click",
  "newsletter_signup",
  "wishlist_add",
  "wishlist_remove",
  "review_submitted",
];

/** Events that don't count as an interaction (bounce maths). Mirrored in SQL. */
export const PASSIVE_EVENTS: readonly EventName[] = ["view_item"];

export function isEventName(v: unknown): v is EventName {
  return typeof v === "string" && (EVENT_NAMES as readonly string[]).includes(v);
}

const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** Search terms are free text: strip anything that looks like an email. */
export function scrubSearchTerm(raw: string, maxLength = 100): string {
  const trimmed = raw.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return EMAIL_LIKE.test(trimmed) ? "[email]" : trimmed;
}
