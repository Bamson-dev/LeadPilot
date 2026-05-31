// LeadThur — Business Discovery Intelligence
// Built by Bamidele

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LeadThur — Find Business Contacts In Seconds",
  description:
    "Type any business type and city. Get hundreds of contacts with phone numbers, emails, and websites in under 60 seconds. 195 countries covered.",
  metadataBase: new URL("https://www.leadthur.com"),
  openGraph: {
    title: "LeadThur — Find Business Contacts In Seconds",
    description:
      "Type any business type and city. Get hundreds of contacts with phone numbers, emails, and websites in under 60 seconds.",
    url: "https://www.leadthur.com",
    siteName: "LeadThur",
    images: [
      {
        url: "https://www.leadthur.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "LeadThur",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadThur — Find Business Contacts In Seconds",
    description:
      "Type any business type and city. Get hundreds of contacts in under 60 seconds.",
    images: ["https://www.leadthur.com/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
