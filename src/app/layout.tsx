/**
 * Root layout — html/body shell, font loading, and globally-mounted
 * components (cart drawer, GA script). Every page is wrapped by this.
 */

import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit, Gilda_Display } from "next/font/google";
import CartDrawer from "@/components/cart/CartDrawer";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
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
  title: "Charmistry | Water & Tarnish Resistant Jewellery",
  description:
    "Discover exquisite jewellry. From diamond solitaires to statement pieces, Charmistry brings you luxury redefined.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${outfit.variable} ${gilda.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GoogleAnalytics />
        {children}
        <CartDrawer />
      </body>
    </html>
  );
}
