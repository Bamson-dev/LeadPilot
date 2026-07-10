"use client";

import Link from "next/link";
import { SALE_PRICE_USD } from "@/constants/pricing";
import { CHECKOUT, C, FONT, TAP_TARGET } from "./theme";

const TIER_ONE = [
  { item: "1,000+ potential clients per search forever", price: "$60" },
  { item: "Direct phone numbers and verified emails", price: "$45" },
  { item: "The email sender built into the dashboard", price: "$50" },
  { item: "Unlimited CSV export of every search", price: "$25" },
];

const TIER_TWO = [
  "AI outreach writer that drafts every pitch.",
  "Done for you pitch templates by service.",
  "Open tracking and automatic follow ups.",
  "Search history and 195 countries.",
  "Every feature we add later at no extra charge.",
];

export function PricingSection() {
  return (
    <section
      id="offer"
      style={{
        backgroundColor: C.bg,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 700,
            color: C.purpleLight,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            textAlign: "center",
          }}
        >
          The offer
        </p>
        <h2
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 16px",
            letterSpacing: -1,
            textAlign: "center",
          }}
        >
          Pay once. Find clients forever.
        </h2>
        <p
          style={{
            fontSize: 16,
            color: C.muted,
            lineHeight: 1.65,
            margin: "0 0 32px",
            textAlign: "center",
          }}
        >
          One client pays for this many times over. Land a single business anywhere in the world,
          charge them properly, and this cost you nothing at all.
        </p>

        <div
          style={{
            padding: "24px",
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            background: C.bgCard,
            marginBottom: 20,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 16px" }}>
            What you are getting
          </h3>
          {TIER_ONE.map((row) => (
            <div
              key={row.item}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                padding: "10px 0",
                borderBottom: `1px solid ${C.border}`,
                fontSize: 14,
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: C.text }}>{row.item}</span>
              <span style={{ color: C.muted, textDecoration: "line-through" }}>{row.price}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "24px",
            borderRadius: 14,
            border: "1px solid rgba(16,185,129,0.35)",
            background: "rgba(16,185,129,0.05)",
            marginBottom: 28,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 800, color: C.green, margin: "0 0 16px" }}>
            Included when you claim a slot today
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {TIER_TWO.map((item) => (
              <li
                key={item}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "8px 0",
                  fontSize: 14,
                  color: C.text,
                  lineHeight: 1.5,
                }}
              >
                <span>{item}</span>
                <span style={{ color: C.green, fontWeight: 800, flexShrink: 0 }}>FREE</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 15,
              color: C.muted,
              textDecoration: "line-through",
            }}
          >
            $300
          </p>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 16,
              color: C.muted,
              textDecoration: "line-through",
            }}
          >
            $100 per year
          </p>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: "clamp(48px, 10vw, 72px)",
              fontWeight: 900,
              color: C.text,
              letterSpacing: -2,
            }}
          >
            ${SALE_PRICE_USD}
          </p>
          <p style={{ margin: 0, fontSize: 15, color: C.muted, fontWeight: 600 }}>
            Once. Never again.
          </p>
        </div>

        <Link
          href={CHECKOUT}
          className="marketing-cta-glow"
          style={{
            ...TAP_TARGET,
            width: "100%",
            padding: "16px 24px",
            borderRadius: 14,
            background: C.purple,
            color: "#fff",
            fontSize: 17,
            fontWeight: 800,
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          Claim My Lifetime Access
        </Link>

        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: C.orange,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          6 of 20 lifetime slots left at this price. When the last slot goes, everyone after you
          pays $100 every year.
        </p>
      </div>
    </section>
  );
}
