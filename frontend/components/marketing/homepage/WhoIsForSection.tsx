"use client";

import Link from "next/link";
import { CHECKOUT, C, FONT } from "./theme";

const AUDIENCES = [
  { emoji: "🎨", label: "Web Designers" },
  { emoji: "📱", label: "SMMA Owners" },
  { emoji: "🔍", label: "SEO Agencies" },
  { emoji: "✍️", label: "Copywriters" },
  { emoji: "📞", label: "Sales Teams" },
  { emoji: "📧", label: "Cold Email Agencies" },
  { emoji: "💼", label: "Consultants" },
  { emoji: "🖥️", label: "Virtual Assistants" },
];

export function WhoIsForSection() {
  return (
    <section
      style={{
        backgroundColor: C.bg,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
        <h2
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 12px",
            letterSpacing: -1,
          }}
        >
          If you sell any service to businesses, this is for you.
        </h2>
        <p
          style={{
            fontSize: 16,
            color: C.muted,
            maxWidth: 560,
            margin: "0 auto 40px",
            lineHeight: 1.6,
          }}
        >
          It does not matter where you are or how big your business is. If you need more
          businesses to pitch, LeadThur was built for you.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 40,
          }}
        >
          {AUDIENCES.map((a) => (
            <div
              key={a.label}
              style={{
                padding: "20px 16px",
                borderRadius: 12,
                background: C.bgCard,
                border: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{a.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{a.label}</div>
            </div>
          ))}
        </div>

        <Link
          href={CHECKOUT}
          style={{
            display: "inline-block",
            padding: "16px 32px",
            borderRadius: 12,
            background: C.purple,
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          This is for me. Get access →
        </Link>
      </div>
    </section>
  );
}
