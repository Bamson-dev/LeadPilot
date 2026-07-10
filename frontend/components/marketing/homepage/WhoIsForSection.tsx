"use client";

import { C, FONT } from "./theme";

const AUDIENCES = [
  "Web designers",
  "Social media managers",
  "SEO specialists",
  "Copywriters",
  "Sales teams",
  "Agency owners",
  "Consultants",
  "Virtual assistants",
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
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <h2
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 32px",
            letterSpacing: -1,
          }}
        >
          If you sell anything to businesses, this is yours.
        </h2>

        <div className="who-grid">
          {AUDIENCES.map((label) => (
            <div
              key={label}
              style={{
                padding: "16px 14px",
                borderRadius: 12,
                background: C.bgCard,
                border: `1px solid ${C.border}`,
                fontSize: 14,
                fontWeight: 700,
                color: C.text,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .who-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 768px) {
          .who-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
      `}</style>
    </section>
  );
}
