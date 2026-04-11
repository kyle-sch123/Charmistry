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
  price: number;
  image_url: string | null;
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
