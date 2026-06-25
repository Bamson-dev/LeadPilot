import { C, FONT } from "./theme";

const OLD_WAY = [
  "Hours on Google searching one business at a time",
  "Paying someone to build a contact list that takes days",
  "Data that is wrong or out of date by the time you get it",
  "Running out of leads by midweek",
  "Waiting for referrals that may never come",
];

const NEW_WAY = [
  "1,000+ contacts in 60 seconds any city any country",
  "Direct phone numbers and emails included",
  "Fresh live data every time you search",
  "Unlimited searches any niche any city",
  "Export and start pitching the same day",
];

export function DifferenceSection() {
  return (
    <section
      style={{
        backgroundColor: C.bgSecondary,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 900,
            color: C.text,
            textAlign: "center",
            margin: "0 0 40px",
            letterSpacing: -1,
          }}
        >
          There is the hard way. And then there is this.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          <div
            style={{
              padding: "28px",
              borderRadius: 14,
              background: C.bgCard,
              border: `1px solid rgba(239,68,68,0.4)`,
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, color: C.red, margin: "0 0 20px" }}>
              The old way
            </h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {OLD_WAY.map((item) => (
                <li
                  key={item}
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 12,
                    fontSize: 14,
                    color: C.muted,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: C.red, fontWeight: 700 }}>✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div
            style={{
              padding: "28px",
              borderRadius: 14,
              background: C.bgCard,
              border: `1px solid rgba(16,185,129,0.4)`,
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, color: C.green, margin: "0 0 20px" }}>
              The LeadThur way
            </h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {NEW_WAY.map((item) => (
                <li
                  key={item}
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 12,
                    fontSize: 14,
                    color: C.muted,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: C.green, fontWeight: 700 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
