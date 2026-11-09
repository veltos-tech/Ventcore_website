import { Footer } from "@/components/layout/Footer";
import { About } from "@/components/sections/About";
import { Certificates } from "@/components/sections/Certificates";
import { Faq } from "@/components/sections/Faq";
import { Hero } from "@/components/sections/Hero";
import { LeadSection } from "@/components/sections/LeadSection";
import { Portfolio } from "@/components/sections/Portfolio";
import { Process } from "@/components/sections/Process";
import { Services } from "@/components/sections/Services";
import { WhyUs } from "@/components/sections/WhyUs";
import { JsonLd } from "@/components/ui/JsonLd";
import { homeStructuredData } from "@/lib/structured-data";

export default function HomePage() {
  return (
    <>
      <JsonLd data={homeStructuredData()} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-navy"
      >
        Перейти к содержимому
      </a>
      <Hero />
      <main id="main">
        <About />
        <Services />
        <WhyUs />
        <Process />
        <Portfolio />
        <Certificates />
        <Faq />
        <LeadSection />
      </main>
      <Footer />
    </>
  );
}
