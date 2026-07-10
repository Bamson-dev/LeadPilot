import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Try LeadThur Free — 2 Searches, No Card",
  description:
    "Type your service and any city. Get real businesses with phone numbers and email addresses in about 60 seconds. Two free searches, no card required.",
  keywords:
    "free lead generation, find business contacts free, business search tool, free trial lead generation, find clients free",
  alternates: {
    canonical: "https://www.leadthur.com/freetrial",
  },
  openGraph: {
    title: "Try LeadThur Free — 2 Searches, No Card",
    description:
      "Get real businesses with phone numbers and email addresses in about 60 seconds. Two free searches, no card required.",
    url: "https://www.leadthur.com/freetrial",
    siteName: "LeadThur",
    images: [
      {
        url: "https://www.leadthur.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "LeadThur Free Trial",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Try LeadThur Free — 2 Searches, No Card",
    description:
      "Get real businesses with phone numbers and email addresses in about 60 seconds. Two free searches, no card required.",
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

export default function FreeTrialLayout({ children }: { children: React.ReactNode }) {
  return children;
}
