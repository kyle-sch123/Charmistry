/** Home page — composes the marketing sections in narrative order. */

import Navbar from "@/components/layout/Navbar";
import MarqueeBanner from "@/components/layout/MarqueeBanner";
import HeroSection from "@/components/sections/HeroSection";
import CategoriesGrid from "@/components/sections/CategoriesGrid";
import CollectionsSection from "@/components/sections/CollectionsSection";
import BestSellers from "@/components/sections/BestSellers";
import AboutSection from "@/components/sections/AboutSection";
import Testimonials from "@/components/sections/Testimonials";
import ShippingPayments from "@/components/sections/ShippingPayments";
import AssuranceBanner from "@/components/sections/AssuranceBanner";
import SectionDivider from "@/components/ui/SectionDivider";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Navbar overHero />
      <main className="flex-1">
        <HeroSection />

        {/* Marquee starts under the hero, then sticks to the very top as the
            user scrolls. The navbar slides down out of its way (see Navbar's
            overHero scroll handling) so the banner ends up docked above it. */}
        <div className="sticky top-0 z-40">
          <MarqueeBanner />
        </div>

        <BestSellers />

        <SectionDivider />

        <Testimonials />

        <SectionDivider />

        <AboutSection />

        <SectionDivider />
        <CategoriesGrid />

        <SectionDivider />
        <CollectionsSection />

        <SectionDivider />
        <ShippingPayments />

        <AssuranceBanner />
      </main>
      <Footer />
    </>
  );
}
