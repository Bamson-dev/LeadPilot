import { C, FONT } from "./theme";

const POINTS = [
  "Thirty days to change your mind, email us and we refund you completely without asking you to justify it.",
  "Keep everything you exported, every lead you downloaded stays yours after the refund clears.",
  "No subscription to escape from, there is nothing to cancel because you were never billed twice.",
];

export function GuaranteeSection() {
  return (
    <section
      style={{
        backgroundColor: C.bgSecondary,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
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
          You carry no risk here
        </p>
        <h2
          style={{
            fontSize: "clamp(26px, 4vw, 36px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 28px",
            letterSpacing: -0.5,
            lineHeight: 1.2,
          }}
        >
          Run one search. If it gives you nothing, we send your money back.
        </h2>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {POINTS.map((point) => (
            <li
              key={point.slice(0, 40)}
              style={{
                display: "flex",
                gap: 12,
                fontSize: 15,
                color: C.muted,
                lineHeight: 1.65,
              }}
            >
              <span style={{ color: C.green, fontWeight: 800, flexShrink: 0 }}>+</span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
