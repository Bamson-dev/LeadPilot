import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Try LeadThur Free — No Signup Needed",
  description:
    "Run free searches on LeadThur right now. Find real businesses with phone numbers, addresses, and Google ratings in any city worldwide. No credit card. No account needed. Results in 60 seconds.",
  keywords:
    "free lead generation, find business contacts free, business search tool no signup, free trial lead generation, find clients free",
  alternates: {
    canonical: "https://www.leadthur.com/freetrial",
  },
  openGraph: {
    title: "Try LeadThur Free — No Signup Needed",
    description:
      "Find real businesses with phone numbers and emails in any city. No credit card. No account. Results in 60 seconds.",
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
    title: "Try LeadThur Free — No Signup Needed",
    description:
      "Find real businesses with phone numbers and emails in any city. No signup needed. Results in 60 seconds.",
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
