import { C, FONT } from "./theme";

const FEATURES = [
  {
    title: "Direct phone numbers",
    body: "Call or text the business directly, not a switchboard that goes nowhere.",
  },
  {
    title: "Verified email addresses",
    body: "Real addresses pulled from their website, not guessed placeholders.",
  },
  {
    title: "Email sender built in",
    body: "Send from the same dashboard where you found the leads.",
  },
  {
    title: "AI outreach writer",
    body: "Describe what you sell once and get a pitch drafted for each business.",
  },
  {
    title: "Open tracking",
    body: "See who opened your email so you know who to follow up with.",
  },
  {
    title: "Automatic follow ups",
    body: "Set the timing once and let the tool chase the warm ones.",
  },
  {
    title: "Google ratings and reviews",
    body: "Spot businesses already losing customers before you pitch them.",
  },
  {
    title: "Clients in 195 countries",
    body: "Pull leads in London, Toronto, Dubai, or your own city in the same search.",
  },
  {
    title: "Unlimited CSV export",
    body: "Download every search and own the list forever.",
  },
];

export function FeatureGridSection() {
  return (
    <section
      id="features"
      style={{
        backgroundColor: C.bgSecondary,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              style={{
                padding: "24px",
                borderRadius: 14,
                background: C.bgCard,
                border: `1px solid ${C.border}`,
              }}
            >
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: C.text,
                  margin: "0 0 10px",
                }}
              >
                {feature.title}
              </h3>
              <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.6 }}>
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .feature-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 768px) {
          .feature-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </section>
  );
}
