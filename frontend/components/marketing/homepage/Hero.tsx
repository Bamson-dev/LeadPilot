"use client";

import Link from "next/link";
import { C, FONT, FREETRIAL, TAP_TARGET } from "./theme";

function scrollToOffer() {
  const el = document.getElementById("offer");
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

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
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13,
            fontWeight: 600,
            color: C.green,
            letterSpacing: "0.02em",
          }}
        >
          Rated 5 stars on Trustpilot
        </p>

        <h1
          style={{
            fontSize: "clamp(32px, 5.5vw, 56px)",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 1.08,
            margin: "0 0 24px",
            color: C.text,
          }}
        >
          Somebody Less Talented Than You Is Fully Booked This Month.
        </h1>

        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: C.muted,
            maxWidth: 680,
            margin: "0 auto 32px",
          }}
        >
          They open a list of businesses every Monday and email all of them. You open Instagram and
          hope somebody finds you. LeadThur builds that same list from any city on earth in about 60
          seconds, with real phone numbers and real email addresses, then sends the emails for you.
        </p>

        <button
          type="button"
          onClick={scrollToOffer}
          className="marketing-cta-glow"
          style={{
            ...TAP_TARGET,
            width: "100%",
            maxWidth: 440,
            margin: "0 auto 14px",
            padding: "14px 28px",
            borderRadius: 14,
            background: C.purple,
            color: "#fff",
            fontSize: 17,
            fontWeight: 800,
            border: "none",
            cursor: "pointer",
            fontFamily: FONT,
          }}
        >
          Get My Client List Now
        </button>

        <Link
          href={FREETRIAL}
          style={{
            ...TAP_TARGET,
            fontSize: 15,
            fontWeight: 600,
            color: C.purpleLight,
            textDecoration: "underline",
            margin: "0 auto",
          }}
        >
          Prove it works on your own search
        </Link>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 32,
            maxWidth: 420,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {[
            "Over 1,000 contacts per search.",
            "Any city in 195 countries.",
            "Email sender built in.",
          ].map((line) => (
            <p key={line} style={{ margin: 0, fontSize: 14, color: C.text, lineHeight: 1.5 }}>
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
