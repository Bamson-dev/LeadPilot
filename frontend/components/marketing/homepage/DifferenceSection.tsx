import { C, FONT } from "./theme";

const OLD_WAY = [
  "Hours on Google hunting for one contact form.",
  "DMs that get opened and quietly ignored.",
  "Losing twenty percent of every job to Upwork.",
  "Stuck pitching whoever happens to live near you.",
  "Paying monthly for a lead list you never own.",
  "Waiting for referrals that arrive whenever they feel like it.",
  "Paying a second tool just to send the emails.",
];

const NEW_WAY = [
  "One search returns 1,000+ potential clients in 60 seconds.",
  "Direct phone numbers and verified emails, never a contact form.",
  "You keep every dollar, we take no commission ever.",
  "Pitch any city on earth and get paid in their currency.",
  "Pay once and the tool is yours forever.",
  "Email them the same afternoon you find them.",
  "The email sender is already inside.",
];

export function DifferenceSection() {
  return (
    <section
      style={{
        backgroundColor: C.bg,
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

        <div className="difference-columns">
          <div
            style={{
              padding: "28px",
              borderRadius: 14,
              background: C.bgCard,
              border: `1px solid rgba(239,68,68,0.4)`,
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, color: C.red, margin: "0 0 20px" }}>
              How you get clients now
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
                  <span style={{ color: C.red, fontWeight: 700 }}>x</span>
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
              How you get clients with LeadThur
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
                  <span style={{ color: C.green, fontWeight: 700 }}>+</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <style>{`
        .difference-columns {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 768px) {
          .difference-columns {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </section>
  );
}
