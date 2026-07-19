/**
 * Account section nav — vertical rail on desktop, equal-width tab bar on
 * mobile. The four items are split into an even grid so the row always fits
 * the viewport (no overflow scroll, hence no native scrollbar), with a thinner
 * letter-spacing on mobile so the labels stay on one line down to ~320px.
 * Client component only for usePathname (active state).
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { label: "Overview", href: "/account" },
  { label: "Orders", href: "/account/orders" },
  { label: "Wishlist", href: "/account/wishlist" },
  { label: "Settings", href: "/account/settings" },
];

export default function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account">
      <ul className="grid grid-cols-4 md:flex md:flex-col border-b md:border-b-0 border-ink/10">
        {items.map((item) => {
          const active =
            item.href === "/account"
              ? pathname === "/account"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block px-1 py-3 text-center md:px-0 md:py-2.5 md:text-left text-[11px] tracking-[0.1em] md:tracking-[0.2em] uppercase font-body transition-colors whitespace-nowrap",
                  "border-b-2 md:border-b-0 md:border-l-2 md:pl-4",
                  active
                    ? "border-ink text-ink"
                    : "border-transparent text-ink/45 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
