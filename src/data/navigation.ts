/** Static nav-link sets used by Navbar, MobileMenu, and Footer. */

import { NavLink } from "@/types";

export const navLinks: NavLink[] = [
  { label: "Shop", href: "/shop" },
  { label: "BestSellers", href: "/best-sellers" },
  { label: "Collections", href: "/collections" },
  { label: "FAQ", href: "/faq" },
];

// The Daily Affair link returns here when the collection launches (its page
// is built but gated — see collections/daily-affair/page.tsx).
export const collectionLinks: NavLink[] = [
  { label: "All Collections", href: "/collections" },
  { label: "Everyday Edit", href: "/collections/everyday" },
];

export const shopCategories: NavLink[] = [
  { label: "All Pieces", href: "/shop" },
  { label: "Rings", href: "/shop?category=rings" },
  { label: "Necklaces", href: "/shop?category=necklaces" },
  { label: "Earrings", href: "/shop?category=earrings" },
  { label: "Bracelets", href: "/shop?category=bracelets" },
  { label: "Jewellery Boxes", href: "/shop?category=jewellery-boxes" },
];
