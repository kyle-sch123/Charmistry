/** Home page — composes the marketing sections in narrative order. */

import Navbar from "@/components/layout/Navbar";
import HeroSection from "@/components/sections/HeroSection";
import CategoriesGrid from "@/components/sections/CategoriesGrid";
import BestSellers from "@/components/sections/BestSellers";
import AboutSection from "@/components/sections/AboutSection";
import Testimonials from "@/components/sections/Testimonials";
import ShippingPayments from "@/components/sections/ShippingPayments";
import SectionDivider from "@/components/ui/SectionDivider";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Navbar overHero />
      <main className="flex-1">
        <HeroSection />

        <BestSellers />

        <SectionDivider />

        <CategoriesGrid />

        <SectionDivider />

        <Testimonials />

        <SectionDivider />

        <AboutSection />

        <SectionDivider />

        <ShippingPayments />
      </main>
      <Footer />
    </>
  );
}
