import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit, Gilda_Display } from "next/font/google";
import CartDrawer from "@/components/cart/CartDrawer";
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
  title: "Charmistry | Luxury Jewelry",
  description:
    "Discover exquisite handcrafted jewelry. From diamond solitaires to statement pieces, Charmistry brings you luxury redefined.",
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
        {children}
        <CartDrawer />
      </body>
    </html>
  );
}
