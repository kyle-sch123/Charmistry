"use client";

import Logo from "@/components/icons/Logo";

const footerLinks = {
  "Quick Links": [
    { label: "New Arrivals", href: "#" },
    { label: "Best Sellers", href: "#" },
    { label: "Collections", href: "#collection" },
    { label: "Gift Guide", href: "#" },
  ],
  "Customer Care": [
    { label: "Shipping & Returns", href: "#" },
    { label: "Ring Size Guide", href: "#" },
    { label: "Care Instructions", href: "#" },
    { label: "FAQ", href: "#" },
  ],
  "Connect": [
    { label: "Instagram", href: "#" },
    { label: "Pinterest", href: "#" },
    { label: "Facebook", href: "#" },
    { label: "Contact Us", href: "#contact" },
  ],
};

export default function Footer() {
  return (
    <footer id="contact" className="bg-obsidian border-t border-graphite/30 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-16 md:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand column */}
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="text-smoke text-sm font-body leading-relaxed max-w-xs">
              Exquisite handcrafted jewelry for those who appreciate the finer things.
              Every piece tells a story of artistry and elegance.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-ivory font-body text-xs tracking-[0.2em] uppercase font-medium mb-6">
                {title}
              </h4>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-smoke hover:text-gold text-sm font-body transition-colors duration-300 py-1 inline-block"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-graphite/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-smoke/60 text-xs font-body">
            &copy; {new Date().getFullYear()} Charmistry. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-smoke/40 text-xs font-body">
            <a href="#" className="hover:text-gold transition-colors">Privacy Policy</a>
            <span>&middot;</span>
            <a href="#" className="hover:text-gold transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
