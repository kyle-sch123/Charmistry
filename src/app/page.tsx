import Navbar from "@/components/layout/Navbar";
import HeroSection from "@/components/sections/HeroSection";
import BestSellers from "@/components/sections/BestSellers";
import AboutSection from "@/components/sections/AboutSection";
import Testimonials from "@/components/sections/Testimonials";
import ShippingPayments from "@/components/sections/ShippingPayments";
import NewsletterCTA from "@/components/sections/NewsletterCTA";
import SectionDivider from "@/components/ui/SectionDivider";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Dark hero → light collection */}
        <HeroSection />

        <BestSellers />

        {/* Light → dark break */}
        <SectionDivider />

        <AboutSection />

        {/* Light → dark break */}
        <SectionDivider />

        <Testimonials />

        <SectionDivider />

        <ShippingPayments />
      </main>
      <Footer />
    </>
  );
}
