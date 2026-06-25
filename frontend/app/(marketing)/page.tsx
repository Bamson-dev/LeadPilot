"use client";

import { AnnouncementBar } from "@/components/marketing/homepage/AnnouncementBar";
import { DifferenceSection } from "@/components/marketing/homepage/DifferenceSection";
import { FAQSection } from "@/components/marketing/homepage/FAQSection";
import { FinalCTASection } from "@/components/marketing/homepage/FinalCTASection";
import { Footer } from "@/components/marketing/homepage/Footer";
import { Hero } from "@/components/marketing/homepage/Hero";
import { HowItWorksSection } from "@/components/marketing/homepage/HowItWorksSection";
import { LogoBar } from "@/components/marketing/homepage/LogoBar";
import "@/components/marketing/homepage/marketing-keyframes.css";
import { Nav } from "@/components/marketing/homepage/Nav";
import { OutcomesSection } from "@/components/marketing/homepage/OutcomesSection";
import { PricingSection } from "@/components/marketing/homepage/PricingSection";
import { StandaloneAssuranceSection } from "@/components/marketing/homepage/StandaloneAssuranceSection";
import { StatsBar } from "@/components/marketing/homepage/StatsBar";
import { ToastNotifications } from "@/components/marketing/homepage/ToastNotifications";
import { TrustpilotSection } from "@/components/marketing/homepage/TrustpilotSection";
import { WhoIsForSection } from "@/components/marketing/homepage/WhoIsForSection";
import { C } from "@/components/marketing/homepage/theme";

export default function MarketingHomePage() {
  return (
    <div
      style={{
        backgroundColor: C.bg,
        color: C.text,
        minHeight: "100vh",
      }}
    >
      <AnnouncementBar />
      <Nav />
      <Hero />
      <LogoBar />
      <StatsBar />
      <PricingSection variant="primary" />
      <TrustpilotSection />
      <OutcomesSection />
      <DifferenceSection />
      <WhoIsForSection />
      <HowItWorksSection />
      <PricingSection variant="secondary" />
      <StandaloneAssuranceSection />
      <FAQSection />
      <FinalCTASection />
      <Footer />
      <ToastNotifications />
    </div>
  );
}
