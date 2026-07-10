import { C, FONT } from "./theme";

const POINTS = [
  "The email sender is already inside, no second tool and no second bill.",
  "It sends from your own inbox, your name and your address and every reply comes to you.",
  "The AI writes the pitch for you, describe what you sell once and it drafts a message built to get a reply.",
  "You see exactly who opened it, chase the ones already paying attention.",
  "Follow ups run themselves, set the timing once and it keeps working while you sleep.",
  "Verified emails only, guessed addresses never get contacted so your sending stays clean.",
];

export function EmailSenderSection() {
  return (
    <section
      style={{
        backgroundColor: C.bgSecondary,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
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
          Included with your access
        </p>
        <h2
          style={{
            fontSize: "clamp(26px, 4vw, 36px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 20px",
            letterSpacing: -0.5,
            lineHeight: 1.2,
          }}
        >
          Find them and email them from the same screen.
        </h2>
        <p
          style={{
            fontSize: 16,
            color: C.muted,
            lineHeight: 1.7,
            margin: "0 0 28px",
          }}
        >
          Every other tool sells you a list, then sends you off to buy a second tool to email it, and
          charges you every month for both. LeadThur hands you both for one payment you make once.
          Tick the businesses you want, let the AI write the pitch, and press send. The email leaves
          from your own address, so when they reply the reply lands in your inbox and you close the
          client yourself with nobody standing in the way.
        </p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {POINTS.map((point) => (
            <li
              key={point}
              style={{
                display: "flex",
                gap: 12,
                fontSize: 15,
                color: C.text,
                lineHeight: 1.55,
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
