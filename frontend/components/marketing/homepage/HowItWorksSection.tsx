import { C, FONT } from "./theme";

const STEPS = [
  {
    n: "1",
    title: "Type your service and any city.",
    body: "Dentists in Manchester, law firms in Toronto, hotels in Dubai, any business any city on earth.",
  },
  {
    n: "2",
    title: "Watch the contacts stream in.",
    body: "Phone numbers, verified emails, websites and Google ratings fill the table in front of you.",
  },
  {
    n: "3",
    title: "Let the AI write your pitch.",
    body: "Describe what you sell and it drafts the email, change whatever you like before it goes.",
  },
  {
    n: "4",
    title: "Send and watch the replies.",
    body: "Emails go from your own address, see who opened, follow up on the warm ones, close the deal.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      style={{
        backgroundColor: C.bgSecondary,
        padding: "72px 24px",
        fontFamily: FONT,
        borderTop: `1px solid ${C.border}`,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
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
                <p style={{ fontSize: 15, color: C.muted, margin: 0, lineHeight: 1.6 }}>
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
