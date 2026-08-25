/** Static nav-link sets used by Navbar, MobileMenu, and Footer. */

import { NavLink } from "@/types";
import { DAILY_AFFAIR_LIVE } from "@/lib/daily-affair";

export const navLinks: NavLink[] = [
  { label: "Shop", href: "/shop" },
  { label: "BestSellers", href: "/best-sellers" },
  { label: "Collections", href: "/collections" },
  { label: "FAQ", href: "/faq" },
];

// The route, the /collections card and this link all read the same
// DAILY_AFFAIR_LIVE flag in lib/daily-affair.ts.
export const collectionLinks: NavLink[] = [
  { label: "All Collections", href: "/collections" },
  { label: "Everyday Edit", href: "/collections/everyday" },
  ...(DAILY_AFFAIR_LIVE
    ? [{ label: "Daily Affair", href: "/collections/daily-affair" }]
    : []),
];

export const shopCategories: NavLink[] = [
  { label: "All Pieces", href: "/shop" },
  { label: "Rings", href: "/shop?category=rings" },
  { label: "Necklaces", href: "/shop?category=necklaces" },
  { label: "Earrings", href: "/shop?category=earrings" },
  { label: "Bracelets", href: "/shop?category=bracelets" },
  { label: "Jewellery Boxes", href: "/shop?category=jewellery-boxes" },
];
