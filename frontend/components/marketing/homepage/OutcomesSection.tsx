"use client";

import Link from "next/link";
import { CHECKOUT, C, FONT } from "./theme";

const CARDS = [
  {
    icon: "📞",
    title: "Direct Phone Numbers",
    body: "Not the switchboard number that nobody picks up. Direct numbers ready for a call or a WhatsApp message right now.",
  },
  {
    icon: "✉️",
    title: "Email Addresses",
    body: "Stop hunting through websites that have a generic contact form and nothing else. LeadThur pulls the actual email address automatically.",
  },
  {
    icon: "⭐",
    title: "Google Ratings Show You Who Needs Help",
    body: "Every business with a low rating is already losing customers. That is your easiest opening. LeadThur surfaces them instantly.",
  },
  {
    icon: "📋",
    title: "One-Click Export",
    body: "Click once. Clean spreadsheet. Start pitching within the hour.",
  },
  {
    icon: "🌍",
    title: "195 Countries, Any City",
    body: "Lagos. London. Dubai. New York. Nairobi. Wherever your ideal clients are, LeadThur finds them.",
  },
  {
    icon: "⚡",
    title: "Live Results In Real Time",
    body: "You watch businesses load onto your screen as the search runs. Not a static list. Live. It is genuinely satisfying to see.",
  },
];

export function OutcomesSection() {
  return (
    <section
      style={{
        backgroundColor: C.bg,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 900,
              color: C.text,
              margin: "0 0 12px",
              letterSpacing: -1,
            }}
          >
            Everything you need to fill your pipeline today.
          </h2>
          <p style={{ fontSize: 16, color: C.muted, maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
            One search. One city. Over 1,000 businesses with every contact detail you need to
            start pitching immediately.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
            marginBottom: 40,
          }}
        >
          {CARDS.map((card) => (
            <div
              key={card.title}
              style={{
                padding: "24px",
                borderRadius: 14,
                background: C.bgCard,
                border: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{card.icon}</div>
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: C.text,
                  margin: "0 0 10px",
                }}
              >
                {card.title}
              </h3>
              <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.6 }}>
                {card.body}
              </p>
            </div>
          ))}
        </div>

        <Link
          href={CHECKOUT}
          className="marketing-cta-glow"
          style={{
            display: "block",
            maxWidth: 440,
            margin: "0 auto",
            padding: "16px 28px",
            borderRadius: 14,
            background: C.purple,
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          Start Finding Clients Now →
        </Link>
      </div>
    </section>
  );
}
