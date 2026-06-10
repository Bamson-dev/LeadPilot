import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LeadThur — Find 1,000+ Business Contacts in Any City in 60 Seconds",
  description:
    "Type any business type and any city. LeadThur returns real businesses with their direct phone numbers, emails, websites, and Google ratings in under 60 seconds. Any niche. Any city. 195 countries. Try free with no signup.",
  keywords:
    "lead generation tool, find business contacts, business discovery, freelancer leads, agency leads, Apollo alternative, Hunter alternative, find clients fast, WhatsApp leads, Nigeria leads, Africa leads, global lead generation",
  alternates: {
    canonical: "https://www.leadthur.com",
  },
  openGraph: {
    title: "LeadThur — Find 1,000+ Business Contacts in Any City in 60 Seconds",
    description:
      "Type any business type and city. Get 1,000+ businesses with phone numbers, emails, websites and ratings in under 60 seconds. 195 countries. Try free.",
    url: "https://www.leadthur.com",
    siteName: "LeadThur",
    images: [
      {
        url: "https://www.leadthur.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "LeadThur — Business Discovery Intelligence",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadThur — Find 1,000+ Business Contacts in Any City in 60 Seconds",
    description:
      "Type any business type and city. Get 1,000+ businesses with phone numbers, emails and websites in under 60 seconds. 195 countries.",
    creator: "@BamsonOfficial",
    images: ["https://www.leadthur.com/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
