import { C, FONT } from "./theme";

const STEPS = [
  {
    n: "1",
    title: "Type any business and any city.",
    body: "Two fields. That is it. LeadThur handles everything else.",
    chips: [
      "Restaurants in London",
      "Salons in Dubai",
      "Law firms in New York",
      "Hotels in Nairobi",
      "Gyms in Lagos",
    ],
  },
  {
    n: "2",
    title: "Watch 1,000+ businesses load live.",
    body: "Phone numbers, emails, websites, and Google ratings stream onto your screen in real time in under 60 seconds.",
  },
  {
    n: "3",
    title: "Export and start pitching.",
    body: "One click. Your entire list as a clean spreadsheet. You could be sending your first outreach message within the next hour.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      style={{
        backgroundColor: C.bg,
        padding: "72px 24px",
        fontFamily: FONT,
        borderTop: `1px solid ${C.border}`,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 900,
              color: C.text,
              margin: "0 0 12px",
              letterSpacing: -1,
            }}
          >
            Three steps. Under 60 seconds.
          </h2>
          <p style={{ fontSize: 16, color: C.muted, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
            No training. No setup. No learning curve. You will have your first list of contacts
            before you finish reading this page.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {STEPS.map((step) => (
            <div
              key={step.n}
              style={{
                display: "flex",
                gap: 20,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: C.purple,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {step.n}
              </div>
              <div>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: C.text,
                    margin: "0 0 8px",
                  }}
                >
                  {step.title}
                </h3>
                <p style={{ fontSize: 15, color: C.muted, margin: "0 0 12px", lineHeight: 1.6 }}>
                  {step.body}
                </p>
                {step.chips && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {step.chips.map((chip) => (
                      <span
                        key={chip}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 999,
                          fontSize: 12,
                          color: C.purpleLight,
                          background: "rgba(124,58,237,0.1)",
                          border: "1px solid rgba(124,58,237,0.25)",
                        }}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
