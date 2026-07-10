import Image from "next/image";
import { C, FONT } from "./theme";

/** Add real user message screenshots to frontend/public/testimonials/ when available. */
const USER_MESSAGE_IMAGES: { src: string; width: number; height: number; alt: string }[] = [];

export function UserTestimonialsSection() {
  if (USER_MESSAGE_IMAGES.length === 0) {
    return (
      <section
        style={{
          backgroundColor: C.bgSecondary,
          padding: "72px 24px",
          fontFamily: FONT,
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 36px)",
              fontWeight: 900,
              color: C.text,
              margin: "0 0 12px",
              letterSpacing: -0.5,
            }}
          >
            People are landing clients with this right now.
          </h2>
          <p
            style={{
              fontSize: 16,
              color: C.muted,
              lineHeight: 1.6,
              margin: 0,
              maxWidth: 560,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            These arrived from real users without us asking. We have not touched a word of them.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        backgroundColor: C.bgSecondary,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <h2
          style={{
            fontSize: "clamp(26px, 4vw, 36px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 12px",
            letterSpacing: -0.5,
          }}
        >
          People are landing clients with this right now.
        </h2>
        <p
          style={{
            fontSize: 16,
            color: C.muted,
            lineHeight: 1.6,
            margin: "0 0 32px",
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          These arrived from real users without us asking. We have not touched a word of them.
        </p>
        <div className="user-testimonials-grid">
          {USER_MESSAGE_IMAGES.map((image) => (
            <div
              key={image.src}
              style={{
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                background: C.bgCard,
                padding: 8,
                overflow: "hidden",
              }}
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                style={{ width: "100%", height: "auto", display: "block", borderRadius: 8 }}
              />
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .user-testimonials-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 768px) {
          .user-testimonials-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </section>
  );
}
