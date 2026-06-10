// LeadThur — Business Discovery Intelligence
// Built by Bamidele

import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "LeadThur — Find Business Contacts in 60 Seconds",
    template: "%s | LeadThur",
  },
  description:
    "LeadThur finds businesses in any city worldwide with their direct phone numbers, emails, websites, and Google ratings in under 60 seconds. Used by freelancers, agency owners, and consultants across 195 countries.",
  keywords:
    "lead generation, business contacts, find clients, freelancer tools, SMMA leads, Apollo alternative, business discovery, phone numbers emails, Nigeria leads, Africa lead generation",
  authors: [{ name: "Bamidele Matthew", url: "https://www.leadthur.com" }],
  creator: "Pdigital Marketstore Ltd",
  publisher: "Pdigital Marketstore Ltd",
  metadataBase: new URL("https://www.leadthur.com"),
  openGraph: {
    title: "LeadThur — Find Business Contacts in 60 Seconds",
    description:
      "Find 1,000+ businesses with phone numbers, emails, websites and Google ratings in any city. 195 countries. Try free.",
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
    title: "LeadThur — Find Business Contacts in 60 Seconds",
    description:
      "Find 1,000+ businesses with phone numbers, emails and websites in any city. 195 countries.",
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

async function getSiteScripts(): Promise<{
  headScripts: string;
  bodyScripts: string;
}> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      console.warn("[getSiteScripts] NEXT_PUBLIC_API_URL missing");
      return { headScripts: "", bodyScripts: "" };
    }

    const res = await fetch(`${apiUrl}/public/site-scripts`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.warn("[getSiteScripts] fetch failed:", res.status);
      return { headScripts: "", bodyScripts: "" };
    }

    const data = await res.json();

    console.log("[getSiteScripts] head length:", data.headScripts?.length || 0);
    console.log("[getSiteScripts] body length:", data.bodyScripts?.length || 0);

    return {
      headScripts: data.headScripts || "",
      bodyScripts: data.bodyScripts || "",
    };
  } catch (err) {
    console.warn("[getSiteScripts] error:", err);
    return { headScripts: "", bodyScripts: "" };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { headScripts, bodyScripts } = await getSiteScripts();

  // Extract inline script content from saved script tags
  // next/script requires content as a string prop, not dangerouslySetInnerHTML
  const extractInlineScripts = (html: string): string[] => {
    const results: string[] = [];
    const regex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (match[1].trim()) {
        results.push(match[1].trim());
      }
    }
    // If no script tags found treat entire string as raw JS
    if (results.length === 0 && html.trim() && !html.includes("<")) {
      results.push(html.trim());
    }
    return results;
  };

  const extractExternalScripts = (html: string): string[] => {
    const results: string[] = [];
    const regex = /<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      results.push(match[1]);
    }
    return results;
  };

  const headInlineScripts = headScripts ? extractInlineScripts(headScripts) : [];
  const headExternalScripts = headScripts ? extractExternalScripts(headScripts) : [];
  const bodyInlineScripts = bodyScripts ? extractInlineScripts(bodyScripts) : [];
  const bodyExternalScripts = bodyScripts ? extractExternalScripts(bodyScripts) : [];

  return (
    <html lang="en" className={`dark ${inter.variable}`} data-scroll-behavior="smooth">
      <head />
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Head external scripts — load before page renders */}
        {headExternalScripts.map((src, i) => (
          <Script
            key={`head-ext-${i}`}
            src={src}
            strategy="beforeInteractive"
          />
        ))}

        {/* Head inline scripts — load before interactive */}
        {headInlineScripts.map((content, i) => (
          <Script
            key={`head-inline-${i}`}
            id={`head-script-${i}`}
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ))}

        {children}

        {/* Body external scripts */}
        {bodyExternalScripts.map((src, i) => (
          <Script
            key={`body-ext-${i}`}
            src={src}
            strategy="afterInteractive"
          />
        ))}

        {/* Body inline scripts */}
        {bodyInlineScripts.map((content, i) => (
          <Script
            key={`body-inline-${i}`}
            id={`body-script-${i}`}
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ))}
      </body>
    </html>
  );
}
