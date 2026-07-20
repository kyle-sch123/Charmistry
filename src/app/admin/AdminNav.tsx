/**
 * Shared top navigation for the internal admin tools. Server component — each
 * page passes which section is active, so the current tab reads as selected
 * without shipping any client JS. The wordmark links back to the dashboard.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

const LINKS = [
  { key: "dashboard", href: "/admin", label: "Dashboard" },
  { key: "fulfil", href: "/admin/fulfil", label: "Fulfilment" },
  { key: "catalogue", href: "/admin/catalogue", label: "Catalogue" },
] as const;

export type AdminSection = (typeof LINKS)[number]["key"];

export default function AdminNav({ active }: { active: AdminSection }) {
  return (
    <nav className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <Link
        href="/admin"
        className="text-[10px] tracking-[0.3em] uppercase text-ink/45 font-body hover:text-ink transition-colors"
      >
        Charmistry · Internal
      </Link>
      <ul className="flex items-center gap-6">
        {LINKS.map((link) => {
          const isActive = link.key === active;
          return (
            <li key={link.key}>
              <Link
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative py-1 text-[11px] tracking-[0.2em] uppercase font-body transition-colors",
                  isActive
                    ? "text-ink after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-gold"
                    : "text-ink/45 hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
