"use client";

import Link from "next/link";
import { CHECKOUT, C, FONT, FREETRIAL } from "./theme";

export function FinalCTASection() {
  return (
    <section
      style={{
        backgroundColor: C.bg,
        padding: "80px 24px",
        fontFamily: FONT,
        position: "relative",
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600,
          height: 400,
          background: "radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", maxWidth: 520, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 16px",
            letterSpacing: -1,
          }}
        >
          Your next client is one search away.
        </h2>
        <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.6, margin: "0 0 32px" }}>
          Stop spending time looking. Start spending time closing.
        </p>
        <Link
          href={CHECKOUT}
          className="marketing-cta-glow"
          style={{
            display: "block",
            maxWidth: 420,
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
          Get Lifetime Access Now →
        </Link>
        <Link
          href={FREETRIAL}
          style={{
            display: "block",
            maxWidth: 420,
            margin: "0 auto 12px",
            fontSize: 15,
            fontWeight: 600,
            color: C.purpleLight,
            textDecoration: "none",
          }}
        >
          Try it free first. No card needed →
        </Link>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
          Lifetime access. No monthly fees. No renewal. Ever.
        </p>
      </div>
    </section>
  );
}
