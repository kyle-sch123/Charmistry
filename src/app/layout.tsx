/**
 * Root layout — html/body shell, font loading, and globally-mounted
 * components (cart drawer, GA script). Every page is wrapped by this.
 */

import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit, Gilda_Display } from "next/font/google";
import CartDrawer from "@/components/cart/CartDrawer";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import MetaPixel from "@/components/analytics/MetaPixel";
import Klaviyo from "@/components/analytics/Klaviyo";
import JourneyTracker from "@/components/analytics/JourneyTracker";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-outfit",
  display: "swap",
});

const gilda = Gilda_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-gilda",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Charmistry | Waterproof & Tarnish-resistant jewellery",
  description:
    "Charmistry is a South African Jewellery brand offering modern, minimal charm bracelets and curated accessories designed to mix, match and personalise your everyday style.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-scroll-behavior: globals.css sets `scroll-behavior: smooth` on
    // <html> for in-page anchors (e.g. #stack-builder). Since Next 16 the router
    // only suspends it during page navigations when this attribute is present;
    // without it every route change would glide to the top instead of jumping.
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${cormorant.variable} ${outfit.variable} ${gilda.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Every product and category image on the site is served from this
            Supabase Storage origin, and the first request for one is discovered
            late (client-fetched sections). Warming the connection saves the
            DNS + TLS round trips off that first image. React hoists these into
            <head>. */}
        <link rel="preconnect" href="https://qkgakhluqruqoifknprg.supabase.co" />
        <link
          rel="dns-prefetch"
          href="https://qkgakhluqruqoifknprg.supabase.co"
        />
        <GoogleAnalytics />
        <MetaPixel />
        <Klaviyo />
        <JourneyTracker />
        {children}
        <CartDrawer />
      </body>
    </html>
  );
}
