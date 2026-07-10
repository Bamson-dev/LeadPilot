"use client";

import Link from "next/link";
import { CHECKOUT, C, FONT, TAP_TARGET } from "./theme";

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
      <div style={{ position: "relative", maxWidth: 680, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 20px",
            letterSpacing: -1,
          }}
        >
          They are eating. You are watching.
        </h2>
        <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.7, margin: "0 0 32px" }}>
          Tonight a business owner in London is paying somebody worse than you to build their
          website, because that person knocked and you never did. So is one in Toronto, one in
          Dubai, and one four streets from where you are sitting. Their phone numbers and their
          email addresses are sitting in a list you can pull in the next sixty seconds.
        </p>
        <Link
          href={CHECKOUT}
          className="marketing-cta-glow"
          style={{
            ...TAP_TARGET,
            width: "100%",
            maxWidth: 440,
            margin: "0 auto 16px",
            padding: "16px 28px",
            borderRadius: 14,
            background: C.purple,
            color: "#fff",
            fontSize: 17,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Claim My Lifetime Access
        </Link>
        <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.5 }}>
          $25 once. 30 day refund promise. 6 slots left before it goes to $100 a year.
        </p>
      </div>
    </section>
  );
}
