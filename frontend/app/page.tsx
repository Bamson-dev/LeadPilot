"use client";

import { useCallback, useEffect, useState } from "react";

const PAYSTACK_URL = "https://paystack.shop/pay/Leadpilot";
const FONT = "Inter, sans-serif";

const colors = {
  bg: "#050508",
  bg2: "#0A0A10",
  bg3: "#0F0F18",
  border: "rgba(255,255,255,0.06)",
  border2: "rgba(255,255,255,0.1)",
  text: "#F2F1FF",
  text2: "#8888A8",
  text3: "#555570",
  purple: "#7C3AED",
  purple2: "#9461FA",
  purpleDim: "rgba(124,58,237,0.12)",
  green: "#10B981",
  amber: "#F59E0B",
};

const steps = [
  {
    n: "1",
    title: "Type what you are looking for",
    body: "Enter any business type and any city in the world.",
    chips: [
      "Restaurants in Lagos",
      "Law firms in London",
      "Hotels in Dubai",
      "Gyms in Nairobi",
      "Dentists in New York",
    ],
  },
  {
    n: "2",
    title: "Watch businesses appear live",
    body: "Business names, phone numbers, emails, websites, and ratings stream onto your screen in real time. You watch it happen live as the search runs.",
  },
  {
    n: "3",
    title: "Export and start reaching out today",
    body: "One click downloads everything as a clean spreadsheet. Open in Excel or Google Sheets. Start calling and messaging businesses immediately.",
  },
];

const features = [
  {
    icon: "⚡",
    title: "Live Real-Time Results",
    desc: "Results stream in live as the search runs. Every search is fresh. Always current data from the source.",
  },
  {
    icon: "📞",
    title: "Direct Phone Numbers",
    desc: "Real business phone numbers ready for WhatsApp outreach. No gatekeepers. Straight to the decision maker.",
  },
  {
    icon: "✉️",
    title: "Email Discovery",
    desc: "Contact emails extracted from business websites. LeadPilot finds emails even when they are buried deep in pages.",
  },
  {
    icon: "🌍",
    title: "195+ Countries",
    desc: "Lagos. London. New York. Dubai. Nairobi. Accra. Any business type. Any city. Worldwide coverage.",
  },
  {
    icon: "⭐",
    title: "Ratings and Reviews",
    desc: "See the rating of every business. Filter for ones that clearly need help. That is your opening pitch.",
  },
  {
    icon: "📊",
    title: "One-Click CSV Export",
    desc: "Export everything instantly to a clean spreadsheet. Use in Excel, Google Sheets, or any CRM you already have.",
  },
  {
    icon: "📋",
    title: "Lead Status Tracking",
    desc: "Mark each lead as Contacted, Interested, Closed, or Not Interested. Track your entire pipeline inside LeadPilot.",
  },
  {
    icon: "🔍",
    title: "Smart Area Suggestions",
    desc: "After each search LeadPilot suggests specific areas to search next. Stack searches to build lists of 500 plus businesses.",
  },
  {
    icon: "💬",
    title: "WhatsApp Ready",
    desc: "One tap opens WhatsApp with any business number pre-filled. Start conversations directly from your results.",
  },
];

const who = [
  { icon: "💻", title: "Web Designers", desc: "Find businesses with outdated websites" },
  { icon: "📱", title: "SMMA Owners", desc: "Build client lists by niche and city" },
  { icon: "🔍", title: "SEO Agencies", desc: "Find local businesses needing traffic" },
  { icon: "✍️", title: "Copywriters", desc: "Pitch businesses that need better copy" },
  { icon: "🎯", title: "Sales Teams", desc: "Prospect faster than any manual method" },
  { icon: "💬", title: "WhatsApp Marketers", desc: "Build outreach lists in minutes" },
  { icon: "📈", title: "Consultants", desc: "Find prospects in any industry" },
  { icon: "⚙️", title: "Virtual Assistants", desc: "Deliver lead research 10x faster" },
];

const testimonials = [
  {
    stars: 5,
    text: '"I searched salons in Abuja. Got over 100 contacts in under a minute. Sent WhatsApp messages that afternoon. Two clients responded and I closed both before evening. Paid for itself that same day."',
    result: "✓ 2 clients closed on day one",
    initials: "AO",
    name: "Adewale O.",
    role: "Web Designer, Abuja Nigeria",
    color: "#7C3AED",
  },
  {
    stars: 5,
    text: '"I run a small marketing agency in London. Finding local restaurant clients used to take days of manual research. LeadPilot gave me 90 contacts in under a minute. Closed three within a week."',
    result: "✓ 3 UK restaurant clients closed in one week",
    initials: "JB",
    name: "James B.",
    role: "Marketing Agency Owner, London UK",
    color: "#0891B2",
  },
  {
    stars: 5,
    text: '"I used it to find hotel owners in Dubai. Got phone numbers and emails in seconds. One hotel signed a 3 month social media contract within 48 hours."',
    result: "✓ 3-month contract closed within 48 hours",
    initials: "RA",
    name: "Rania A.",
    role: "Social Media Consultant, Dubai UAE",
    color: "#D97706",
  },
  {
    stars: 5,
    text: '"Searched gyms in Nairobi. Got 80 contacts with phone numbers in about 45 seconds. Two responded. One became a paying client that same week. $15 well spent."',
    result: "✓ Paying client from first day of outreach",
    initials: "WK",
    name: "Wanjiru K.",
    role: "Fitness Brand Consultant, Nairobi Kenya",
    color: "#059669",
  },
];

const pricingFeatures = [
  "Unlimited searches forever",
  "200+ leads per search",
  "Phone numbers and emails",
  "One-click CSV export",
  "Lead status tracking",
  "Smart area suggestions",
  "195+ countries covered",
  "WhatsApp-ready contacts",
  "Lifetime updates included",
];

const faqs = [
  {
    q: "Can I try it before paying?",
    a: "Yes. Go to the free trial page. Run a real search with no signup needed. You get 2 free preview searches that return real business names, addresses, phone numbers, and ratings. Emails and full export are unlocked with full access.",
  },
  {
    q: "Does this work in every country?",
    a: "Yes. LeadPilot covers 195 countries. Lagos, London, New York, Dubai, Nairobi, Toronto, Accra, Johannesburg, Sydney, Singapore. Any business type, any city, anywhere in the world. The more specific the city the more results you get.",
  },
  {
    q: "What happens immediately after I pay?",
    a: "Paystack payments get instant access automatically within 60 seconds. An activation email with your license key arrives immediately. Bank transfer users send payment proof to WhatsApp 09067285890 and receive access within minutes. You are searching the same day you pay.",
  },
  {
    q: "Is there really no monthly fee?",
    a: "Right now there is no monthly fee. $15 once and LeadPilot is yours for life. But this is a limited lifetime deal. LeadPilot is moving to a subscription model very soon. These 20 slots are the last chance to pay once and own it forever. Once slots are gone new users pay monthly. Existing lifetime users are protected forever regardless of when the subscription launches.",
  },
  {
    q: "How many businesses can I find per search?",
    a: "Each search returns up to 200 businesses. After each search LeadPilot suggests specific areas within the city so you can run follow-up searches that stack on top of your existing results. Users regularly build lists of 500 plus businesses in a single session.",
  },
  {
    q: "Can I use this for WhatsApp outreach?",
    a: "Yes. Every result includes a direct phone number with a one-tap WhatsApp button built in. Click it and WhatsApp opens with the number pre-filled. Start outreach the same day you search.",
  },
  {
    q: "How does the affiliate programme work?",
    a: "Every LeadPilot user gets a unique referral link in their dashboard after activation. Share it anywhere. When someone buys through your link you earn 50% of the sale which is $7.50 per referral. Earnings are paid directly to your bank account with no cap on how much you can earn. You must be an active LeadPilot user to access your affiliate link.",
  },
  {
    q: "Is this difficult to use?",
    a: "If you can use Google you can use LeadPilot. Two fields. Business type. City. One button. Results appear within 60 seconds. No setup required. No training. Nothing to install. You are finding contacts the moment you log in.",
  },
];

const affiliateSteps = [
  {
    n: "1",
    title: "Get your link",
    body: "Sign up and get a unique referral link from your dashboard after activation.",
  },
  {
    n: "2",
    title: "Share it anywhere",
    body: "WhatsApp, Twitter, Instagram, YouTube, anywhere your audience is.",
  },
  {
    n: "3",
    title: "Get paid",
    body: "Earn $7.50 for every person who buys through your link. Paid to your bank.",
  },
];

const toasts = [
  { flag: "🇳🇬", text: "Tunde in Lagos just got lifetime access", delay: 0 },
  { flag: "🇬🇧", text: "Sarah in London found 142 restaurant leads", delay: 13 },
  { flag: "🇬🇭", text: "Kwame in Accra activated LeadPilot", delay: 26 },
  { flag: "🇿🇦", text: "Nomsa in Johannesburg found 89 salon contacts", delay: 39 },
  { flag: "🇦🇪", text: "Fatima in Dubai just purchased lifetime access", delay: 52 },
  { flag: "🇰🇪", text: "Brian in Nairobi found 203 gym leads", delay: 65 },
  { flag: "🇺🇸", text: "Mike in New York activated his account", delay: 78 },
  { flag: "🇳🇬", text: "Chidi in Port Harcourt found 167 leads", delay: 91 },
  { flag: "🇬🇧", text: "Emma in Manchester got lifetime access", delay: 104 },
  { flag: "🇦🇪", text: "Omar in Abu Dhabi found 94 hotel contacts", delay: 117 },
  { flag: "🇰🇪", text: "Grace in Mombasa activated LeadPilot", delay: 130 },
  { flag: "🇳🇬", text: "Aisha in Kano found 128 pharmacy leads", delay: 143 },
];

function Stars({ count }: { count: number }) {
  return (
    <span style={{ color: colors.amber, fontSize: 14, letterSpacing: 2 }}>
      {"★".repeat(count)}
    </span>
  );
}

export default function HomePage() {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copiedBank, setCopiedBank] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const copyAccount = useCallback(() => {
    void navigator.clipboard.writeText("0126247556").then(() => {
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    });
  }, []);

  const padX = isMobile ? 20 : 24;
  const sectionPad = isMobile ? "72px 20px" : "80px 24px";

  const navLinks = [
    { href: "#how-it-works", label: "How it works" },
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "#affiliate", label: "Affiliate" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <div
      style={{
        background: colors.bg,
        color: colors.text,
        fontFamily: FONT,
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @keyframes lpToastSlide {
          0% { opacity: 0; transform: translateY(20px); }
          6% { opacity: 1; transform: translateY(0); }
          88% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(20px); }
        }
        .lp-toast {
          animation: lpToastSlide 13s ease-in-out infinite;
          opacity: 0;
        }
      `}</style>

      {/* 1 — Announcement bar */}
      <div
        style={{
          background:
            "linear-gradient(90deg, rgba(124,58,237,0.15), rgba(167,139,250,0.08), rgba(124,58,237,0.15))",
          borderBottom: "1px solid rgba(124,58,237,0.15)",
          padding: "10px 20px",
          textAlign: "center",
          fontSize: 13,
          color: "#C4B5FD",
          fontWeight: 500,
          fontFamily: FONT,
        }}
      >
        🔥{" "}
        <strong style={{ color: colors.text }}>
          Lifetime deal ends soon.
        </strong>{" "}
        Only 20 slots at $15. After that LeadPilot becomes a monthly subscription.
      </div>

      {/* 2 — Navigation */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobile ? "14px 20px" : "16px 24px",
          background: "rgba(5,5,8,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                background: colors.purple,
                borderRadius: 9,
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 800,
                color: "white",
                fontFamily: FONT,
              }}
            >
              LP
            </div>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: -0.5,
                fontFamily: FONT,
              }}
            >
              Lead<span style={{ color: "#A78BFA" }}>Pilot</span>
            </span>
        </div>

        {!isMobile && (
          <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                style={{
                  color: colors.text2,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: FONT,
                }}
              >
                {l.label}
              </a>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isMobile && (
            <>
              <a
                href="/freetrial"
                style={{
                  color: "#A78BFA",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: FONT,
                }}
              >
                Try Free
              </a>
              <a
                href="/activate"
                style={{
                  background: colors.purple,
                  color: "white",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 700,
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontFamily: FONT,
                }}
              >
                Login
              </a>
            </>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label="Menu"
              style={{
                background: "transparent",
                border: `1px solid ${colors.border2}`,
                borderRadius: 8,
                padding: "8px 12px",
                color: colors.text,
                fontSize: 18,
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              {mobileNavOpen ? "✕" : "☰"}
            </button>
          )}
        </div>
      </nav>

      {isMobile && mobileNavOpen && (
        <div
          style={{
            background: colors.bg2,
            borderBottom: `1px solid ${colors.border}`,
            padding: "16px 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileNavOpen(false)}
              style={{
                color: colors.text,
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 500,
                fontFamily: FONT,
              }}
            >
              {l.label}
            </a>
          ))}
          <a
            href="/freetrial"
            style={{
              color: colors.green,
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 700,
              fontFamily: FONT,
            }}
          >
            Try Free
          </a>
          <a
            href="/activate"
            style={{
              background: colors.purple,
              color: "white",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 700,
              padding: "12px 18px",
              borderRadius: 10,
              textAlign: "center",
              fontFamily: FONT,
            }}
          >
            Login
          </a>
        </div>
      )}

      {/* 3 — Hero */}
      <section
        style={{
          position: "relative",
          padding: isMobile ? "72px 20px 60px" : "100px 24px 80px",
          textAlign: "center",
          overflow: "hidden",
          background: colors.bg,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(167,139,250,0.08)",
            border: "1px solid rgba(167,139,250,0.2)",
            padding: "8px 16px",
            borderRadius: 100,
            fontSize: 12,
            color: "#A78BFA",
            marginBottom: 28,
            fontWeight: 600,
            fontFamily: FONT,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              background: colors.green,
              borderRadius: "50%",
              display: "inline-block",
            }}
          />
          Live across 195 countries
        </div>

        <h1
          style={{
            fontSize: isMobile ? 44 : 82,
            fontWeight: 900,
            letterSpacing: -3,
            lineHeight: isMobile ? 1.05 : 1.02,
            marginBottom: 24,
            color: colors.text,
            fontFamily: FONT,
            margin: "0 auto 24px",
            maxWidth: 900,
          }}
        >
          Stop searching
          <br />
          for clients.
          <br />
          <span
            style={{
              background:
                "linear-gradient(135deg, #A78BFA 0%, #7C3AED 50%, #C4B5FD 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Find them in
            <br />
            60 seconds.
          </span>
        </h1>

        <p
          style={{
            fontSize: isMobile ? 16 : 19,
            color: colors.text2,
            maxWidth: 560,
            margin: "0 auto 32px",
            lineHeight: 1.7,
            fontFamily: FONT,
            padding: `0 ${padX}px`,
          }}
        >
          Type any business type and any city in the world.{" "}
          <strong style={{ color: colors.text }}>
            LeadPilot returns real businesses
          </strong>{" "}
          with phone numbers, emails, and addresses. Ready to reach out. Same day.
        </p>

        <p
          style={{
            fontSize: 13,
            color: colors.green,
            fontWeight: 700,
            marginBottom: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontFamily: FONT,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              background: colors.green,
              borderRadius: "50%",
              display: "inline-block",
            }}
          />
          One client from this list pays for LeadPilot 100 times over.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginBottom: 16,
            padding: `0 ${padX}px`,
          }}
        >
          <a
            href={PAYSTACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: colors.purple,
              color: "white",
              fontWeight: 800,
              fontSize: 16,
              padding: "16px 32px",
              borderRadius: 14,
              textDecoration: "none",
              boxShadow: "0 0 50px rgba(124,58,237,0.45)",
              width: isMobile ? "100%" : "auto",
              maxWidth: isMobile ? 400 : "none",
              fontFamily: FONT,
            }}
          >
            Get Lifetime Access — $15
          </a>
          <a
            href="/freetrial"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(167,139,250,0.08)",
              color: "#C4B5FD",
              fontWeight: 700,
              fontSize: isMobile ? 15 : 16,
              padding: isMobile ? "15px 24px" : "15px 32px",
              borderRadius: 14,
              textDecoration: "none",
              border: "1.5px solid rgba(167,139,250,0.4)",
              width: isMobile ? "100%" : "auto",
              maxWidth: isMobile ? 400 : "none",
              transition: "all 0.2s",
              fontFamily: FONT,
            }}
          >
            Try it free first →
          </a>
        </div>

        <p style={{ fontSize: 12, color: colors.text2, fontFamily: FONT }}>
          One payment today.{" "}
          <span style={{ color: colors.green, fontWeight: 600 }}>
            Lifetime access before the subscription launches.
          </span>
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, auto)",
            gap: isMobile ? "20px" : "0 40px",
            justifyContent: "center",
            marginTop: 48,
            paddingTop: 40,
            borderTop: `1px solid ${colors.border}`,
            maxWidth: 720,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {[
            { n: "200+", l: "Leads per search" },
            { n: "60s", l: "To first result" },
            { n: "195+", l: "Countries covered" },
            { n: "$0", l: "Monthly fee" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  color: colors.purple2,
                  letterSpacing: -1,
                  lineHeight: 1,
                  fontFamily: FONT,
                }}
              >
                {s.n}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#7878A0",
                  marginTop: 3,
                  fontFamily: FONT,
                }}
              >
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4 — Video */}
      <div
        style={{
          padding: isMobile ? "0 20px 60px" : "0 24px 80px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#A78BFA",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 16,
            fontFamily: FONT,
          }}
        >
          <strong style={{ color: "#A78BFA" }}>Watch a demo of how it works</strong>
        </p>
        <div
          style={{
            maxWidth: 340,
            margin: "0 auto",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow:
              "0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,58,237,0.2)",
          }}
        >
          <div
            style={{
              background: "#14141E",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#FF5F57",
                display: "inline-block",
              }}
            />
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#FEBC2E",
                display: "inline-block",
              }}
            />
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#28C840",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: "#7878A0",
                marginLeft: 4,
                fontFamily: FONT,
              }}
            >
              LeadPilot — Live Demo
            </span>
          </div>
          <div
            style={{
              width: "100%",
              aspectRatio: "9/16",
              background: "#000",
              position: "relative",
            }}
          >
            <iframe
              src="https://www.youtube.com/embed/uSB2NOFMvWQ?rel=0&modestbranding=1"
              title="LeadPilot demo"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: "none",
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>

      {/* 5 — Free trial */}
      <div
        style={{
          background: colors.bg3,
          borderTop: `1px solid ${colors.border}`,
          borderBottom: `1px solid ${colors.border}`,
          padding: sectionPad,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
            padding: "7px 16px",
            borderRadius: 100,
            fontSize: 11,
            fontWeight: 700,
            color: colors.green,
            marginBottom: 20,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: FONT,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              background: colors.green,
              borderRadius: "50%",
              display: "inline-block",
            }}
          />
          Free Preview
        </div>

        <h2
          style={{
            fontSize: isMobile ? 28 : 42,
            fontWeight: 900,
            letterSpacing: isMobile ? -1 : -1.5,
            color: colors.text,
            marginBottom: 12,
            fontFamily: FONT,
          }}
        >
          See it work before you pay.
        </h2>

        <p
          style={{
            fontSize: 15,
            color: colors.text2,
            lineHeight: 1.7,
            maxWidth: 460,
            margin: "0 auto 24px",
            fontFamily: FONT,
          }}
        >
          Run a real search. Get real business contacts. No signup. No credit card. 2
          free searches.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginBottom: 24,
            padding: `0 ${padX}px`,
          }}
        >
          {[
            "✓ Real business names",
            "✓ Real phone numbers",
            "✓ Real addresses",
            "✓ Google ratings",
            "🔒 Emails with full access",
          ].map((f, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                color: "#C0C0D8",
                fontFamily: FONT,
              }}
            >
              {f}
            </div>
          ))}
        </div>

        <a
          href="/freetrial"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: colors.green,
            color: "white",
            fontWeight: 800,
            fontSize: 16,
            padding: "16px 36px",
            borderRadius: 12,
            textDecoration: "none",
            boxShadow: "0 0 40px rgba(16,185,129,0.3)",
            width: isMobile ? "100%" : "auto",
            maxWidth: isMobile ? 400 : "none",
            fontFamily: FONT,
          }}
        >
          Try LeadPilot Free — No Signup
        </a>

        <p
          style={{
            fontSize: 12,
            color: colors.text2,
            marginTop: 12,
            fontFamily: FONT,
          }}
        >
          2 free searches · Takes 60 seconds · No account needed
        </p>
      </div>

      {/* 6 — How it works */}
      <section
        id="how-it-works"
        style={{
          padding: sectionPad,
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? 28 : 36,
            fontWeight: 900,
            letterSpacing: -1,
            textAlign: "center",
            marginBottom: 48,
            fontFamily: FONT,
          }}
        >
          How it works
        </h2>
        {steps.map((step, idx) => (
          <div
            key={step.n}
            style={{
              marginBottom: idx < steps.length - 1 ? 40 : 0,
              paddingBottom: idx < steps.length - 1 ? 40 : 0,
              borderBottom:
                idx < steps.length - 1 ? `1px solid ${colors.border}` : "none",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: colors.purpleDim,
                border: "1px solid rgba(124,58,237,0.25)",
                display: "grid",
                placeItems: "center",
                fontSize: 18,
                fontWeight: 800,
                color: "#A78BFA",
                marginBottom: 16,
                fontFamily: FONT,
              }}
            >
              {step.n}
            </div>
            <h3
              style={{
                fontSize: 20,
                fontWeight: 800,
                marginBottom: 10,
                color: colors.text,
                fontFamily: FONT,
              }}
            >
              {step.title}
            </h3>
            <p
              style={{
                fontSize: 15,
                color: colors.text2,
                lineHeight: 1.7,
                marginBottom: step.chips ? 16 : 0,
                fontFamily: FONT,
              }}
            >
              {step.body}
            </p>
            {step.chips && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {step.chips.map((chip) => (
                  <span
                    key={chip}
                    style={{
                      fontSize: 12,
                      color: "#A78BFA",
                      background: colors.purpleDim,
                      border: "1px solid rgba(124,58,237,0.2)",
                      padding: "6px 12px",
                      borderRadius: 100,
                      fontFamily: FONT,
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* 7 — Features */}
      <section
        id="features"
        style={{
          padding: sectionPad,
          background: colors.bg2,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? 28 : 36,
            fontWeight: 900,
            letterSpacing: -1,
            textAlign: "center",
            marginBottom: 40,
            fontFamily: FONT,
          }}
        >
          Everything you need to find clients
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: 16,
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                background: colors.bg3,
                border: `1px solid ${colors.border}`,
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  marginBottom: 8,
                  color: colors.text,
                  fontFamily: FONT,
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: colors.text2,
                  lineHeight: 1.6,
                  margin: 0,
                  fontFamily: FONT,
                }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 8 — Who it is for */}
      <section style={{ padding: sectionPad, maxWidth: 1000, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: isMobile ? 28 : 36,
            fontWeight: 900,
            letterSpacing: -1,
            textAlign: "center",
            marginBottom: 40,
            fontFamily: FONT,
          }}
        >
          Built for people who need clients
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          {who.map((w) => (
            <div
              key={w.title}
              style={{
                background: colors.bg3,
                border: `1px solid ${colors.border}`,
                borderRadius: 14,
                padding: isMobile ? 16 : 20,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{w.icon}</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  marginBottom: 4,
                  color: colors.text,
                  fontFamily: FONT,
                }}
              >
                {w.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: colors.text2,
                  lineHeight: 1.4,
                  fontFamily: FONT,
                }}
              >
                {w.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 9 — Testimonials */}
      <section
        style={{
          padding: sectionPad,
          background: colors.bg2,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? 28 : 36,
            fontWeight: 900,
            letterSpacing: -1,
            textAlign: "center",
            marginBottom: 40,
            fontFamily: FONT,
          }}
        >
          Real results from real users
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 16,
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          {testimonials.map((t) => (
            <div
              key={t.name}
              style={{
                background: colors.bg3,
                border: `1px solid ${colors.border}`,
                borderRadius: 16,
                padding: 24,
              }}
            >
              <Stars count={t.stars} />
              <p
                style={{
                  fontSize: 14,
                  color: colors.text2,
                  lineHeight: 1.7,
                  margin: "14px 0",
                  fontFamily: FONT,
                }}
              >
                {t.text}
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: colors.green,
                  fontWeight: 700,
                  marginBottom: 16,
                  fontFamily: FONT,
                }}
              >
                {t.result}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: t.color,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "white",
                    fontFamily: FONT,
                  }}
                >
                  {t.initials}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: colors.text,
                      fontFamily: FONT,
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#7878A0",
                      fontFamily: FONT,
                    }}
                  >
                    {t.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 10 — Pricing */}
      <section
        id="pricing"
        style={{ padding: sectionPad, textAlign: "center" }}
      >
        <h2
          style={{
            fontSize: isMobile ? 28 : 36,
            fontWeight: 900,
            letterSpacing: -1,
            marginBottom: 32,
            fontFamily: FONT,
          }}
        >
          Simple pricing. Pay once.
        </h2>
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto",
            background: colors.bg3,
            border: "1px solid rgba(124,58,237,0.3)",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 0 80px rgba(124,58,237,0.15)",
          }}
        >
          <div
            style={{
              background: colors.purple,
              padding: "10px 20px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: FONT,
            }}
          >
            LIFETIME ACCESS
          </div>
          <div style={{ padding: isMobile ? "28px 18px" : "40px 32px" }}>
            <div
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.25)",
                borderRadius: 10,
                padding: 14,
                fontSize: 13,
                color: "#FCD34D",
                lineHeight: 1.6,
                marginBottom: 24,
                textAlign: "left",
                fontFamily: FONT,
              }}
            >
              ⚠️ This is a limited lifetime deal. LeadPilot is moving to a monthly
              subscription model very soon. These 20 slots are the last chance to pay
              once and own it forever. Several slots have already been taken.
            </div>

            <div style={{ marginBottom: 24 }}>
              <span
                style={{
                  fontSize: 18,
                  color: "#7878A0",
                  textDecoration: "line-through",
                  marginRight: 8,
                  fontFamily: FONT,
                }}
              >
                $45
              </span>
              <span
                style={{
                  fontSize: isMobile ? 64 : 80,
                  fontWeight: 900,
                  color: colors.text,
                  letterSpacing: -2,
                  fontFamily: FONT,
                }}
              >
                $15
              </span>
              <div
                style={{
                  fontSize: 13,
                  color: "#7878A0",
                  marginTop: 4,
                  fontFamily: FONT,
                }}
              >
                One-time payment · Lifetime access
              </div>
            </div>

            <div
              style={{
                textAlign: "left",
                marginBottom: 24,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {pricingFeatures.map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    gap: 10,
                    fontSize: isMobile ? 13 : 14,
                    color: "#8888A8",
                    fontFamily: FONT,
                  }}
                >
                  <span style={{ color: colors.green, fontWeight: 700 }}>✓</span>
                  {item}
                </div>
              ))}
            </div>

            <a
              href={PAYSTACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                background: colors.purple,
                color: "white",
                fontWeight: 800,
                fontSize: 16,
                padding: "16px 24px",
                borderRadius: 12,
                textDecoration: "none",
                marginBottom: 12,
                boxShadow: "0 0 40px rgba(124,58,237,0.4)",
                fontFamily: FONT,
              }}
            >
              Pay with Card — $15
            </a>

            <button
              type="button"
              onClick={() => setShowBank((s) => !s)}
              style={{
                width: "100%",
                background: "transparent",
                border: `1px solid ${colors.border2}`,
                color: colors.text2,
                fontWeight: 600,
                fontSize: 14,
                padding: "14px 24px",
                borderRadius: 12,
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              {showBank ? "Hide bank transfer details" : "Pay by bank transfer (Nigeria)"}
            </button>

            {showBank && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: colors.bg2,
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  textAlign: "left",
                  fontSize: 14,
                  lineHeight: 1.8,
                  fontFamily: FONT,
                }}
              >
                <div>
                  <strong>Bank:</strong> Wema Bank
                </div>
                <div>
                  <strong>Account Name:</strong> Pdigital Marketstore Ltd
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong>Account Number:</strong> 0126247556
                  <button
                    type="button"
                    onClick={copyAccount}
                    style={{
                      background: colors.purpleDim,
                      border: "1px solid rgba(124,58,237,0.3)",
                      color: "#A78BFA",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontFamily: FONT,
                    }}
                  >
                    {copiedBank ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <div>
                  <strong>Amount:</strong> ₦15,000
                </div>
                <div style={{ fontSize: 12, color: colors.text2, marginTop: 8 }}>
                  After payment send proof to WhatsApp{" "}
                  <a
                    href="https://wa.me/2349067285890"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#A78BFA" }}
                  >
                    09067285890
                  </a>
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: 20,
                padding: 14,
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: 10,
                fontSize: 13,
                color: colors.green,
                fontWeight: 600,
                fontFamily: FONT,
              }}
            >
              ✓ 7-day money-back guarantee if LeadPilot does not work for you
            </div>

            <p
              style={{
                fontSize: 11,
                color: colors.text2,
                marginTop: 16,
                fontFamily: FONT,
              }}
            >
              🔒 Secure checkout powered by Paystack
            </p>
          </div>
        </div>
      </section>

      {/* 11 — Affiliate */}
      <section
        id="affiliate"
        style={{
          padding: sectionPad,
          background: colors.bg2,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            textAlign: "center",
            background: "rgba(16,185,129,0.06)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 20,
            padding: isMobile ? 28 : 40,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.25)",
              padding: "7px 16px",
              borderRadius: 100,
              fontSize: 12,
              fontWeight: 700,
              color: colors.green,
              marginBottom: 16,
              fontFamily: FONT,
            }}
          >
            🤝 Earn 50% Per Referral
          </div>
          <p
            style={{
              fontSize: 13,
              color: "#A78BFA",
              fontWeight: 600,
              marginBottom: 12,
              fontFamily: FONT,
            }}
          >
            The most generous affiliate deal in lead generation.
          </p>
          <div
            style={{
              fontSize: isMobile ? 56 : 72,
              fontWeight: 900,
              color: colors.green,
              letterSpacing: -2,
              lineHeight: 1,
              fontFamily: FONT,
            }}
          >
            50%
          </div>
          <h2
            style={{
              fontSize: isMobile ? 24 : 32,
              fontWeight: 900,
              margin: "16px 0 12px",
              fontFamily: FONT,
            }}
          >
            Earn $7.50 for every person you refer.
          </h2>
          <p
            style={{
              fontSize: 14,
              color: colors.text2,
              lineHeight: 1.7,
              marginBottom: 24,
              textAlign: "left",
              fontFamily: FONT,
            }}
          >
            Share your unique referral link. When someone buys LeadPilot through your
            link you earn 50% of every sale. That is $7.50 per referral paid directly
            to your account. No cap on earnings.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginBottom: 32,
            }}
          >
            {[
              { n: "$15", l: "Sale price" },
              { n: "$7.50", l: "Your commission" },
              { n: "∞", l: "No earnings cap" },
            ].map((s) => (
              <div
                key={s.l}
                style={{
                  background: colors.bg3,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: isMobile ? 12 : 16,
                }}
              >
                <div
                  style={{
                    fontSize: isMobile ? 20 : 28,
                    fontWeight: 900,
                    color: "#10B981",
                    marginBottom: 4,
                    fontFamily: FONT,
                  }}
                >
                  {s.n}
                </div>
                <div
                  style={{
                    fontSize: isMobile ? 10 : 12,
                    color: "#7878A0",
                    fontFamily: FONT,
                  }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "left", marginBottom: 24 }}>
            {affiliateSteps.map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12,
                  padding: "16px",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    background: "rgba(16,185,129,0.12)",
                    border: "1px solid rgba(16,185,129,0.25)",
                    borderRadius: 8,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#10B981",
                    flexShrink: 0,
                    fontFamily: FONT,
                  }}
                >
                  {step.n}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#F2F1FF",
                      marginBottom: 4,
                      fontFamily: FONT,
                    }}
                  >
                    {step.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#8888A8",
                      lineHeight: 1.6,
                      fontFamily: FONT,
                    }}
                  >
                    {step.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <a
            href="/affiliate"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: colors.green,
              color: "white",
              fontWeight: 800,
              fontSize: 15,
              padding: "14px 32px",
              borderRadius: 12,
              textDecoration: "none",
              fontFamily: FONT,
            }}
          >
            Join and Start Earning →
          </a>
          <p
            style={{
              fontSize: 12,
              color: colors.text2,
              marginTop: 16,
              lineHeight: 1.6,
              fontFamily: FONT,
            }}
          >
            You must be a LeadPilot user to join the affiliate programme. Your unique
            referral link appears automatically in your dashboard after activation.
          </p>
        </div>
      </section>

      {/* 12 — FAQ */}
      <section id="faq" style={{ padding: sectionPad, maxWidth: 640, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: isMobile ? 28 : 36,
            fontWeight: 900,
            letterSpacing: -1,
            textAlign: "center",
            marginBottom: 32,
            fontFamily: FONT,
          }}
        >
          Frequently asked questions
        </h2>
        {faqs.map((faq, i) => (
          <div
            key={faq.q}
            style={{
              borderBottom: `1px solid ${colors.border}`,
              marginBottom: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                padding: "18px 0",
                background: "transparent",
                border: "none",
                color: colors.text,
                fontSize: 15,
                fontWeight: 700,
                textAlign: "left",
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              {faq.q}
              <span style={{ color: "#7878A0", fontSize: 18 }}>
                {openFaq === i ? "−" : "+"}
              </span>
            </button>
            {openFaq === i && (
              <p
                style={{
                  fontSize: 14,
                  color: colors.text2,
                  lineHeight: 1.7,
                  margin: "0 0 18px",
                  fontFamily: FONT,
                }}
              >
                {faq.a}
              </p>
            )}
          </div>
        ))}
      </section>

      {/* 13 — Final CTA */}
      <section
        style={{
          padding: sectionPad,
          textAlign: "center",
          background: `linear-gradient(180deg, ${colors.bg2} 0%, ${colors.bg} 100%)`,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? 36 : 52,
            fontWeight: 900,
            letterSpacing: -2,
            marginBottom: 16,
            fontFamily: FONT,
          }}
        >
          Stop searching.
          <br />
          Start closing.
        </h2>
        <p
          style={{
            fontSize: 16,
            color: colors.text2,
            maxWidth: 480,
            margin: "0 auto 32px",
            lineHeight: 1.7,
            fontFamily: FONT,
            padding: `0 ${padX}px`,
          }}
        >
          Every business you need to contact is out there. LeadPilot finds them in 60
          seconds.
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: `0 ${padX}px`,
          }}
        >
          <a
            href={PAYSTACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: colors.purple,
              color: "white",
              fontWeight: 800,
              fontSize: 16,
              padding: "16px 32px",
              borderRadius: 14,
              textDecoration: "none",
              boxShadow: "0 0 50px rgba(124,58,237,0.45)",
              width: isMobile ? "100%" : "auto",
              maxWidth: isMobile ? 400 : "none",
              fontFamily: FONT,
            }}
          >
            Get Lifetime Access — $15
          </a>
          <a
            href="/freetrial"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(167,139,250,0.08)",
              color: "#C4B5FD",
              fontWeight: 700,
              fontSize: isMobile ? 15 : 16,
              padding: isMobile ? "15px 24px" : "15px 32px",
              borderRadius: 14,
              textDecoration: "none",
              border: "1.5px solid rgba(167,139,250,0.4)",
              width: isMobile ? "100%" : "auto",
              maxWidth: isMobile ? 400 : "none",
              transition: "all 0.2s",
              fontFamily: FONT,
            }}
          >
            Try it free first →
          </a>
        </div>
      </section>

      {/* 14 — Footer */}
      <footer
        style={{
          padding: isMobile ? "40px 20px" : "48px 24px",
          borderTop: `1px solid ${colors.border}`,
          background: colors.bg,
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            gap: 32,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  background: colors.purple,
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "white",
                  fontFamily: FONT,
                }}
              >
                LP
              </div>
              <span style={{ fontWeight: 800, fontSize: 18, fontFamily: FONT }}>
                LeadPilot
              </span>
            </div>
            <p
              style={{
                fontSize: 13,
                color: "#8888A8",
                lineHeight: 1.6,
                fontFamily: FONT,
              }}
            >
              Business Discovery Intelligence
              <br />
              Built by Bamidele
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#7878A0",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontFamily: FONT,
              }}
            >
              Navigate
            </span>
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                style={{
                  color: "#8888A8",
                  textDecoration: "none",
                  fontSize: 14,
                  fontFamily: FONT,
                }}
              >
                {l.label}
              </a>
            ))}
            <a
              href="/freetrial"
              style={{
                color: "#8888A8",
                textDecoration: "none",
                fontSize: 14,
                fontFamily: FONT,
              }}
            >
              Free Preview
            </a>
            <a
              href="/activate"
              style={{
                color: "#8888A8",
                textDecoration: "none",
                fontSize: 14,
                fontFamily: FONT,
              }}
            >
              Login
            </a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#7878A0",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontFamily: FONT,
              }}
            >
              Contact
            </span>
            <a
              href="https://wa.me/2349067285890"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#8888A8",
                textDecoration: "none",
                fontSize: 14,
                fontFamily: FONT,
              }}
            >
              WhatsApp
            </a>
            <a
              href="mailto:support@leadpilot.live"
              style={{
                color: "#8888A8",
                textDecoration: "none",
                fontSize: 14,
                fontFamily: FONT,
              }}
            >
              support@leadpilot.live
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#8888A8",
                textDecoration: "none",
                fontSize: 14,
                fontFamily: FONT,
              }}
            >
              Twitter
            </a>
          </div>
        </div>
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#6668A8",
            marginTop: 40,
            fontFamily: FONT,
          }}
        >
          © {new Date().getFullYear()} LeadPilot. Built by Bamidele.
        </p>
      </footer>

      {/* 15 — Toasts */}
      <div
        style={{
          position: "fixed",
          bottom: isMobile ? 16 : 24,
          left: isMobile ? 16 : 24,
          zIndex: 200,
          width: isMobile ? "calc(100vw - 32px)" : 320,
          maxWidth: 320,
          height: 56,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t, i) => (
          <div
            key={i}
            className="lp-toast"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: colors.bg3,
              border: `1px solid ${colors.border2}`,
              borderRadius: 12,
              padding: "12px 14px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              animationDelay: `${t.delay}s`,
              fontFamily: FONT,
            }}
          >
            <span style={{ fontSize: 18 }}>{t.flag}</span>
            <span style={{ fontSize: 13, color: colors.text, fontWeight: 500 }}>
              {t.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
