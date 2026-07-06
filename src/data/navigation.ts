/** Static nav-link sets used by Navbar, MobileMenu, and Footer. */

import { NavLink } from "@/types";

export const navLinks: NavLink[] = [
  { label: "New In", href: "/shop?sort=newest" },
  { label: "Shop", href: "/shop" },
  { label: "Best Sellers", href: "/shop?sort=best-selling" },
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
