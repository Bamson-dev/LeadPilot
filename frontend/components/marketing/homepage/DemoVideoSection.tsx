"use client";

import { useState } from "react";
import { C, FONT } from "./theme";

const VIDEO_ID = "miaium-rONk";
const THUMBNAIL = `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`;

export function DemoVideoSection() {
  const [loaded, setLoaded] = useState(false);

  return (
    <section
      style={{
        backgroundColor: C.bg,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 700,
            color: C.purpleLight,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Ninety seconds
        </p>
        <h2
          style={{
            fontSize: "clamp(26px, 4vw, 36px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 12px",
            letterSpacing: -0.5,
          }}
        >
          Watch it pull business contacts live.
        </h2>
        <p
          style={{
            fontSize: 16,
            color: C.muted,
            lineHeight: 1.6,
            margin: "0 0 32px",
          }}
        >
          One search. Over a thousand potential clients. Every phone number and email on screen.
        </p>

        <div
          style={{
            borderRadius: 14,
            overflow: "hidden",
            border: `1px solid ${C.border}`,
            background: C.bgCard,
            boxShadow: "0 0 60px rgba(124,58,237,0.15)",
            maxWidth: 800,
            margin: "0 auto",
          }}
        >
          {!loaded ? (
            <button
              type="button"
              onClick={() => setLoaded(true)}
              aria-label="Play demo video"
              style={{
                position: "relative",
                width: "100%",
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                display: "block",
              }}
            >
              <img
                src={THUMBNAIL}
                alt="LeadThur demo video thumbnail"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
              <span
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "rgba(124,58,237,0.92)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 900,
                  boxShadow: "0 0 40px rgba(124,58,237,0.5)",
                }}
              >
                ▶
              </span>
            </button>
          ) : (
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                title="LeadThur demo"
                src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1`}
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
          )}
        </div>
      </div>
    </section>
  );
}
