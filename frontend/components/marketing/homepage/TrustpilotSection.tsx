import Image from "next/image";
import { C, FONT } from "./theme";

const IMAGES = [
  "https://pdigitalhq.com/wp-content/uploads/2026/06/leadthur-trustpilot-1-.png",
  "https://pdigitalhq.com/wp-content/uploads/2026/06/leadthur-trustpilot-2.png",
  "https://pdigitalhq.com/wp-content/uploads/2026/06/leadthur-trustpilot-3.png",
  "https://pdigitalhq.com/wp-content/uploads/2026/06/leadthur-trustpilot-4.png",
  "https://pdigitalhq.com/wp-content/uploads/2026/06/leadthur-trustpilot-5.png",
];

export function TrustpilotSection() {
  return (
    <section
      id="reviews"
      style={{
        backgroundColor: C.bgSecondary,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 999,
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 600,
            color: C.green,
          }}
        >
          <span style={{ fontSize: 16 }}>★</span>
          Rated 5 stars on Trustpilot
        </div>
        <h2
          style={{
            fontSize: "clamp(26px, 4vw, 36px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 32px",
            letterSpacing: -0.5,
          }}
        >
          What users are saying publicly.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            marginBottom: 16,
          }}
          className="trustpilot-grid-top"
        >
          {IMAGES.slice(0, 3).map((src, i) => (
            <div
              key={src}
              style={{
                position: "relative",
                borderRadius: 12,
                overflow: "hidden",
                border: `1px solid ${C.border}`,
                aspectRatio: "4/3",
              }}
            >
              <Image
                src={src}
                alt={`Trustpilot review ${i + 1}`}
                fill
                unoptimized
                style={{ objectFit: "cover" }}
              />
            </div>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
            maxWidth: 680,
            margin: "0 auto",
          }}
          className="trustpilot-grid-bottom"
        >
          {IMAGES.slice(3).map((src, i) => (
            <div
              key={src}
              style={{
                position: "relative",
                borderRadius: 12,
                overflow: "hidden",
                border: `1px solid ${C.border}`,
                aspectRatio: "4/3",
              }}
            >
              <Image
                src={src}
                alt={`Trustpilot review ${i + 4}`}
                fill
                unoptimized
                style={{ objectFit: "cover" }}
              />
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .trustpilot-grid-top { grid-template-columns: 1fr !important; }
          .trustpilot-grid-bottom { grid-template-columns: 1fr !important; max-width: 100% !important; }
        }
      `}</style>
    </section>
  );
}
