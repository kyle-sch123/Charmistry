/** Home page — composes the marketing sections in narrative order. */

import Navbar from "@/components/layout/Navbar";
import HeroSection from "@/components/sections/HeroSection";
import CategoriesGrid from "@/components/sections/CategoriesGrid";
import BestSellers from "@/components/sections/BestSellers";
import AboutSection from "@/components/sections/AboutSection";
import Testimonials from "@/components/sections/Testimonials";
import ShippingPayments from "@/components/sections/ShippingPayments";
import EmailClub from "@/components/sections/EmailClub";
import SectionDivider from "@/components/ui/SectionDivider";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Navbar overHero />
      <main className="flex-1">
        {/* 1. Brand hook — full-screen hero */}
        <HeroSection />

        {/* 2. Discovery — what we sell */}
        <CategoriesGrid />

        <SectionDivider />

        {/* 3. Social proof through product — bestsellers */}
        <BestSellers />

        <SectionDivider />

        {/* 4. Brand story + mid-page email capture */}
        <AboutSection />

        <SectionDivider />

        {/* 5. Customer social proof */}
        <Testimonials />

        <SectionDivider />

        {/* 6. Trust signals — shipping & payments */}
        <ShippingPayments />

        {/* 7. Final conversion — email club */}
        <EmailClub />
      </main>
      <Footer />
    </>
  );
}
