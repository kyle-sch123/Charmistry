export type MetalType = "gold" | "silver" | "rose_gold" | "white_gold" | "platinum";

export type BadgeType = "NEW" | "BESTSELLER" | "LIMITED";

export type CategoryType = "rings" | "necklaces" | "earrings" | "bracelets" | "jewellery-boxes";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  category_id: string | null;
  metal: MetalType | null;
  badge: BadgeType | null;
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

export type OrderStatus = "pending" | "paid" | "failed" | "cancelled";

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
  total: number;
  currency: string;
  status: OrderStatus;
  payfast_payment_id: string | null;
  payfast_pf_payment_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
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
