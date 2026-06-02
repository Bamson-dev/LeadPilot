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

async function getSiteScripts(): Promise<{
  headScripts: string;
  bodyScripts: string;
}> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      console.warn("[getSiteScripts] NEXT_PUBLIC_API_URL is not set");
      return { headScripts: "", bodyScripts: "" };
    }

    console.log("[getSiteScripts] fetching from:", `${apiUrl}/public/site-scripts`);

    const res = await fetch(`${apiUrl}/public/site-scripts`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.warn("[getSiteScripts] fetch failed with status:", res.status);
      return { headScripts: "", bodyScripts: "" };
    }

    const data = await res.json();

    console.log("[getSiteScripts] headScripts length:", data.headScripts?.length || 0);
    console.log("[getSiteScripts] bodyScripts length:", data.bodyScripts?.length || 0);

    return {
      headScripts: data.headScripts || "",
      bodyScripts: data.bodyScripts || "",
    };
  } catch (err) {
    console.warn("[getSiteScripts] error:", err);
    return { headScripts: "", bodyScripts: "" };
  }
}

function HeadScriptInjector({ scripts }: { scripts: string }) {
  // Strips outer <script> tags and renders inner content as an inline script.
  // Works for a single script block. Multiple separate <script> tags need a richer parser.
  // For Meta Pixel, paste inner JavaScript only (no outer <script> tags) in Head Scripts.
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: scripts
            .replace(/<script[^>]*>/gi, "")
            .replace(/<\/script>/gi, "")
            .trim(),
        }}
      />
    </>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { headScripts, bodyScripts } = await getSiteScripts();

  return (
    <html lang="en" className={`dark ${inter.variable}`} data-scroll-behavior="smooth">
      <head>
        {headScripts ? <HeadScriptInjector scripts={headScripts} /> : null}
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        {bodyScripts ? (
          <div dangerouslySetInnerHTML={{ __html: bodyScripts }} />
        ) : null}
      </body>
    </html>
  );
}
