"use client";

import Link from "next/link";
import { CHECKOUT, C, FONT, FREETRIAL } from "./theme";

export function Hero() {
  return (
    <section
      style={{
        backgroundColor: C.bg,
        padding: "64px 24px 56px",
        position: "relative",
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(900px, 90vw)",
          height: 400,
          background: "radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", position: "relative" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.25)",
            marginBottom: 28,
            fontSize: 13,
            fontWeight: 600,
            color: C.green,
          }}
        >
          <span
            className="marketing-pulse-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: C.green,
              display: "inline-block",
            }}
          />
          Freelancers and agencies worldwide are landing clients with this every single day.
        </div>

        <h1
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            margin: "0 0 8px",
            color: C.text,
          }}
        >
          Stop Wasting Time
          <br />
          On Clients That Never Reply.
        </h1>
        <p
          style={{
            fontSize: "clamp(32px, 5vw, 56px)",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 1.08,
            margin: "0 0 24px",
            color: C.purpleLight,
          }}
        >
          Find 1,000+ Businesses
          <br />
          Ready To Buy In 60 Seconds.
        </p>

        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: C.muted,
            maxWidth: 560,
            margin: "0 auto 32px",
          }}
        >
          Type any business. Type any city. Get back over 1,000 businesses with direct phone
          numbers, emails, and websites. Any country. Start pitching the same day.
        </p>

        <div style={{ maxWidth: 700, margin: "0 auto 28px" }}>
          <div
            style={{
              borderRadius: 14,
              overflow: "hidden",
              border: `1px solid ${C.border}`,
              background: C.bgCard,
              boxShadow: "0 0 60px rgba(124,58,237,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                background: "#0A0A12",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {["#FF5F57", "#FEBC2E", "#28C840"].map((dot) => (
                  <div
                    key={dot}
                    style={{ width: 10, height: 10, borderRadius: "50%", background: dot }}
                  />
                ))}
              </div>
              <div
                style={{
                  flex: 1,
                  marginLeft: 8,
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: C.bgSecondary,
                  fontSize: 12,
                  color: C.muted,
                  textAlign: "center",
                }}
              >
                leadthur.com
              </div>
            </div>
            <p
              style={{
                margin: 0,
                padding: "10px 16px",
                fontSize: 12,
                color: C.muted,
                textAlign: "left",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              LeadThur — Watch it find businesses live.
            </p>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                title="LeadThur demo"
                src="https://www.youtube.com/embed/ILM1P9L-BKA"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            maxWidth: 700,
            margin: "0 auto 28px",
            padding: "16px 20px",
            borderRadius: 12,
            background: "rgba(16,185,129,0.06)",
            border: "1px solid rgba(16,185,129,0.25)",
            fontSize: 14,
            lineHeight: 1.6,
            color: C.text,
          }}
        >
          The only prospecting tool that returns 1,000+ verified business contacts with direct
          phone numbers, emails, and websites in under 60 seconds. Any city. Any country. No
          monthly fees.
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 10,
            marginBottom: 32,
          }}
        >
          {["⚡ Results in 60 seconds", "🌍 195 countries", "📋 1,000+ businesses per search"].map(
            (pill) => (
              <span
                key={pill}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                }}
              >
                {pill}
              </span>
            )
          )}
        </div>

        <Link
          href={CHECKOUT}
          className="marketing-cta-glow"
          style={{
            display: "block",
            maxWidth: 440,
            margin: "0 auto 14px",
            padding: "18px 28px",
            borderRadius: 14,
            background: C.purple,
            color: "#fff",
            fontSize: 17,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Start Finding Clients Now →
        </Link>
        <Link
          href={FREETRIAL}
          style={{
            display: "block",
            maxWidth: 440,
            margin: "0 auto 12px",
            padding: "14px 28px",
            fontSize: 15,
            fontWeight: 600,
            color: C.purpleLight,
            textDecoration: "none",
          }}
        >
          Try it free first. No card needed →
        </Link>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 16px" }}>
          Lifetime access. No monthly fees. No renewal.
        </p>
        <span
          style={{
            display: "inline-block",
            padding: "8px 16px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            color: C.orange,
            background: "rgba(249,115,22,0.1)",
            border: "1px solid rgba(249,115,22,0.3)",
          }}
        >
          🔥 Lifetime deal. Price goes up when slots run out.
        </span>
      </div>
    </section>
  );
}
