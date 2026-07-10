"use client";

import { AnnouncementBar } from "@/components/marketing/homepage/AnnouncementBar";
import { DemoVideoSection } from "@/components/marketing/homepage/DemoVideoSection";
import { DifferenceSection } from "@/components/marketing/homepage/DifferenceSection";
import { EmailSenderSection } from "@/components/marketing/homepage/EmailSenderSection";
import { FAQSection } from "@/components/marketing/homepage/FAQSection";
import { FeatureGridSection } from "@/components/marketing/homepage/FeatureGridSection";
import { FinalCTASection } from "@/components/marketing/homepage/FinalCTASection";
import { Footer } from "@/components/marketing/homepage/Footer";
import { FreeTrialInviteSection } from "@/components/marketing/homepage/FreeTrialInviteSection";
import { GuaranteeSection } from "@/components/marketing/homepage/GuaranteeSection";
import { Hero } from "@/components/marketing/homepage/Hero";
import { HowItWorksSection } from "@/components/marketing/homepage/HowItWorksSection";
import "@/components/marketing/homepage/marketing-keyframes.css";
import { Nav } from "@/components/marketing/homepage/Nav";
import { PricingSection } from "@/components/marketing/homepage/PricingSection";
import { ProblemAgitationSection } from "@/components/marketing/homepage/ProblemAgitationSection";
import { StatsBar } from "@/components/marketing/homepage/StatsBar";
import { TrustpilotSection } from "@/components/marketing/homepage/TrustpilotSection";
import { UserTestimonialsSection } from "@/components/marketing/homepage/UserTestimonialsSection";
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
      <StatsBar />
      <ProblemAgitationSection />
      <FreeTrialInviteSection />
      <EmailSenderSection />
      <DemoVideoSection />
      <UserTestimonialsSection />
      <TrustpilotSection />
      <HowItWorksSection />
      <DifferenceSection />
      <FeatureGridSection />
      <PricingSection />
      <GuaranteeSection />
      <WhoIsForSection />
      <FAQSection />
      <FinalCTASection />
      <Footer />
    </div>
  );
}
