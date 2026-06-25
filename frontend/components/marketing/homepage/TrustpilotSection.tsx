import Image from "next/image";
import { C, FONT } from "./theme";

const REVIEWS = [
  { src: "/trustpilot/1.png", width: 1024, height: 619 },
  { src: "/trustpilot/2.png", width: 1024, height: 559 },
  { src: "/trustpilot/3.png", width: 1024, height: 584 },
  { src: "/trustpilot/4.png", width: 1024, height: 575 },
  { src: "/trustpilot/5.png", width: 1024, height: 590 },
] as const;

function ReviewCard({
  src,
  width,
  height,
  alt,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
}) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: C.bgCard,
        padding: 8,
        overflow: "hidden",
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: 8,
        }}
      />
    </div>
  );
}

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
      <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
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
          {REVIEWS.slice(0, 3).map((review, i) => (
            <ReviewCard
              key={review.src}
              src={review.src}
              width={review.width}
              height={review.height}
              alt={`Trustpilot review ${i + 1}`}
            />
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
            maxWidth: 720,
            margin: "0 auto",
          }}
          className="trustpilot-grid-bottom"
        >
          {REVIEWS.slice(3).map((review, i) => (
            <ReviewCard
              key={review.src}
              src={review.src}
              width={review.width}
              height={review.height}
              alt={`Trustpilot review ${i + 4}`}
            />
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
