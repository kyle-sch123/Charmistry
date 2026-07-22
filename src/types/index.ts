/**
 * Domain types shared between server, client, and the Supabase schema.
 *
 * Field naming mirrors the Supabase columns (snake_case) for everything
 * the DB owns (Product, Order, OrderItem, DiscountCode), and camelCase for
 * UI-only types (CartLine, CheckoutFormData, Testimonial, NavLink).
 *
 * The `payfast_payment_id` column stores our own `m_payment_id` (= order id)
 * set at checkout, and `payfast_pf_payment_id` stores PayFast's
 * `pf_payment_id` (their internal payment reference) set when the ITN
 * lands. Both can be null while the order is still pending.
 */

// --- Catalogue ---------------------------------------------------------
//
// MetalType is the variant axis on Product — one DB row per (name, metal).
// The shop grid collapses variants into a single tile (see queries.ts),
// and the PDP surfaces the available metals as a swatch picker.

export type MetalType =
  | "gold"
  | "silver"
  | "rose_gold"
  | "white_gold"
  | "platinum";

export type BadgeType = "NEW" | "BESTSELLER" | "LIMITED";

export type CategoryType =
  | "rings"
  | "necklaces"
  | "earrings"
  | "bracelets"
  | "jewellery-boxes";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  category_id: string | null;
  metal: MetalType | null;
  badge: BadgeType | null;
  material: string | null;
  size: string | number | null;
  image_url: string | null;
  images: string[];
  in_stock: boolean;
  rating: number | null;
  review_count: number;
  quantity: number;
  created_at: string;
}

export interface CartLine {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  metal: MetalType | null;
  /**
   * Category slug snapshot (e.g. "rings"), taken at add-time. Powers cart-aware
   * category stacks (Stack & Save). Null for products without a category, and
   * absent on lines saved before this field existed — treat missing as null.
   */
  category: string | null;
  quantity: number;
  maxQuantity: number;
}

export interface ProductWithCategory extends Product {
  categories: Pick<Category, "name" | "slug"> | null;
}

export interface Category {
  id: string;
  name: string;
  slug: CategoryType;
  description: string | null;
  image_url: string | null;
  created_at: string;
}

export interface CategoryWithCount extends Category {
  product_count: number;
}

export interface Testimonial {
  id: string;
  customerName: string;
  rating: number;
  text: string;
  productName?: string;
  date: string;
  verified: boolean;
}

export interface NavLink {
  label: string;
  href: string;
}

// --- Order Lifecycle ---------------------------------------------------
//
// Orders are inserted in `pending` state by /api/checkout and flipped to
// `paid` by the PayFast ITN handler (or directly to `paid` for R0 totals).
// Transitions:
//   pending  -> paid       (ITN COMPLETE)
//   pending  -> failed     (payment-request build error, amount mismatch,
//                           DB error, ITN payment_status=FAILED)
//   pending  -> cancelled  (ITN payment_status=CANCELLED)
//
// ShippingStatus is separate so a paid order can transition independently
// through dispatch:
//   pending  -> created  -> shipped  -> delivered
//   ...      -> failed   (Courier Guy errored)

export type OrderStatus = "pending" | "paid" | "failed" | "cancelled";
export type ShippingStatus =
  | "pending"
  | "created"
  | "shipped"
  | "delivered"
  | "failed";

export interface CheckoutFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  country: string;
  notes?: string;
}

export interface Order {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  subtotal: number;
  shipping_cost: number;
  /** Chosen carrier: "pudo_locker" | "courier_economy". Null for legacy orders. */
  shipping_method: string | null;
  total: number;
  currency: string;
  status: OrderStatus;
  shipping_status: ShippingStatus;
  courier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  waybill_number: string | null;
  shipped_at: string | null;
  payfast_payment_id: string | null;
  payfast_pf_payment_id: string | null;
  /** Owning auth user. NULL for guest orders and after account deletion. */
  user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  discount_code: string | null;
  discount_amount: number;
}

export type DiscountType = "percentage" | "fixed";

export interface DiscountCode {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
  email: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string;
  product_image_url: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

// --- Accounts ----------------------------------------------------------
//
// One profiles row per auth.users row, created by the on_auth_user_created
// trigger (migration 008). The default_* address prefills checkout for
// signed-in customers. All fields except id/timestamps are owner-editable
// via RLS from /account/settings.

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  marketing_opt_in: boolean;
  default_address_line1: string | null;
  default_address_line2: string | null;
  default_city: string | null;
  default_postal_code: string | null;
  default_country: string;
  created_at: string;
  updated_at: string;
}

export interface WishlistItem {
  user_id: string;
  product_id: string;
  created_at: string;
}

// --- Reviews -----------------------------------------------------------
//
// One row per (user, product) written only by the service role via
// /api/reviews after a purchase check (migration 009). Reviews are scoped to
// the logical piece: a review on any metal variant is aggregated across every
// sibling row sharing (name, category_id). author_name is a "First L."
// snapshot taken from the reviewer profile at submit time.

export type StarRating = 1 | 2 | 3 | 4 | 5;

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}

/** Aggregate over a piece's reviews — powers the summary bars + products cache. */
export interface RatingSummary {
  /** Mean rating rounded to 2dp, or 0 when there are no reviews. */
  average: number;
  count: number;
  /** Number of reviews at each star level (1–5). */
  distribution: Record<StarRating, number>;
  /** Share of reviews at each star level, 0–100, rounded to whole percent. */
  percentages: Record<StarRating, number>;
}
