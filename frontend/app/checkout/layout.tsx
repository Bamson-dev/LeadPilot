import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get LeadThur — Start Finding Clients Today",
  description:
    "Get full access to LeadThur and start finding business contacts in any city in the world in under 60 seconds. Phone numbers, emails, websites, and Google ratings. 195 countries covered.",
  keywords:
    "get LeadThur, business contact finder, lead generation access, find clients tool, freelancer prospecting tool, agency lead generation",
  alternates: {
    canonical: "https://www.leadthur.com/checkout",
  },
  openGraph: {
    title: "Get LeadThur — Start Finding Clients Today",
    description:
      "Get full access to LeadThur. Find 1,000+ business contacts in any city in 60 seconds. Phone numbers, emails, websites. 195 countries.",
    url: "https://www.leadthur.com/checkout",
    siteName: "LeadThur",
    images: [
      {
        url: "https://www.leadthur.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Get LeadThur",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Get LeadThur — Start Finding Clients Today",
    description:
      "Get full access to LeadThur. Find 1,000+ business contacts in any city in 60 seconds. 195 countries.",
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

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
