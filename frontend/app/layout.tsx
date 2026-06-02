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
  // Extract all script tag contents and render each as a real script element
  // Also handle noscript tags for pixel fallbacks
  const scriptContents: string[] = [];
  const noscriptContents: string[] = [];

  // Match all script tag inner contents
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(scripts)) !== null) {
    if (match[1].trim()) {
      scriptContents.push(match[1].trim());
    }
  }

  // Match all noscript tag inner contents
  const noscriptRegex = /<noscript[^>]*>([\s\S]*?)<\/noscript>/gi;
  while ((match = noscriptRegex.exec(scripts)) !== null) {
    if (match[1].trim()) {
      noscriptContents.push(match[1].trim());
    }
  }

  // If no script tags found, treat the entire content as raw JS
  if (scriptContents.length === 0 && !scripts.includes("<")) {
    scriptContents.push(scripts.trim());
  }

  return (
    <>
      {scriptContents.map((content, index) => (
        <script
          key={`head-script-${index}`}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ))}
      {noscriptContents.map((content, index) => (
        <noscript
          key={`head-noscript-${index}`}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ))}
    </>
  );
}

function BodyScriptInjector({ scripts }: { scripts: string }) {
  return <div dangerouslySetInnerHTML={{ __html: scripts }} />;
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { headScripts, bodyScripts } = await getSiteScripts();

  return (
    <html lang="en" className={`dark ${inter.variable}`} data-scroll-behavior="smooth">
      <head>
        {headScripts && headScripts.trim() ? (
          <HeadScriptInjector scripts={headScripts} />
        ) : null}
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        {bodyScripts && bodyScripts.trim() ? (
          <BodyScriptInjector scripts={bodyScripts} />
        ) : null}
      </body>
    </html>
  );
}
