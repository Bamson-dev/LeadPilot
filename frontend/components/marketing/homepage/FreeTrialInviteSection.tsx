"use client";

import Link from "next/link";
import { C, FONT, FREETRIAL, TAP_TARGET } from "./theme";

export function FreeTrialInviteSection() {
  return (
    <section
      style={{
        backgroundColor: C.bg,
        padding: "72px 24px",
        fontFamily: FONT,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 700,
            color: C.green,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Zero risk
        </p>
        <h2
          style={{
            fontSize: "clamp(26px, 4vw, 36px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 20px",
            letterSpacing: -0.5,
          }}
        >
          Do not believe a word of this. Go and prove it.
        </h2>
        <p
          style={{
            fontSize: 16,
            color: C.muted,
            lineHeight: 1.65,
            margin: "0 0 28px",
          }}
        >
          You have seen it work in the video. Now run it on your own service, in whatever city you
          want to sell into, and watch real businesses come back with real phone numbers and real
          email addresses on your screen. Two searches, no card, nothing to cancel, no clock running
          against you.
        </p>
        <Link
          href={FREETRIAL}
          className="marketing-cta-glow"
          style={{
            ...TAP_TARGET,
            width: "100%",
            maxWidth: 440,
            margin: "0 auto",
            padding: "14px 28px",
            borderRadius: 14,
            background: C.purple,
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Prove It On My Own Search
        </Link>
      </div>
    </section>
  );
}
