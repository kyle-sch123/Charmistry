/** Static nav-link sets used by Navbar, MobileMenu, and Footer. */

import { NavLink } from "@/types";

export const navLinks: NavLink[] = [
  { label: "Shop", href: "/shop" },
  { label: "BestSellers", href: "/best-sellers" },
  { label: "FAQ", href: "/faq" },
];

export const shopCategories: NavLink[] = [
  { label: "All Pieces", href: "/shop" },
  { label: "Rings", href: "/shop?category=rings" },
  { label: "Necklaces", href: "/shop?category=necklaces" },
  { label: "Earrings", href: "/shop?category=earrings" },
  { label: "Bracelets", href: "/shop?category=bracelets" },
  { label: "Jewellery Boxes", href: "/shop?category=jewellery-boxes" },
];
