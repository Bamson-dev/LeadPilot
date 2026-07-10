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
        backgroundColor: C.bg,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <h2
          style={{
            fontSize: "clamp(26px, 4vw, 36px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 32px",
            letterSpacing: -0.5,
          }}
        >
          What people say where we cannot edit it.
        </h2>

        <div className="trustpilot-grid-top">
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
        <div className="trustpilot-grid-bottom">
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
        .trustpilot-grid-top {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .trustpilot-grid-bottom {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          max-width: 720px;
          margin: 0 auto;
        }
        @media (min-width: 768px) {
          .trustpilot-grid-top {
            grid-template-columns: repeat(3, 1fr);
          }
          .trustpilot-grid-bottom {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </section>
  );
}
