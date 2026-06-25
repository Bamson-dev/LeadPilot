import { C, FONT } from "./theme";

export function StandaloneAssuranceSection() {
  return (
    <section
      style={{
        backgroundColor: C.bg,
        padding: "72px 24px",
        fontFamily: FONT,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            margin: "0 auto 20px",
            color: C.green,
          }}
        >
          ✓
        </div>
        <h2
          style={{
            fontSize: "clamp(26px, 4vw, 36px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 16px",
            letterSpacing: -0.5,
          }}
        >
          We are confident this works.
        </h2>
        <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.65, margin: 0 }}>
          LeadThur has returned results in every city it has been tested in across 195 countries.
          If your very first search comes back empty we will sort it out immediately. We have never
          had to. But the option is there if you ever need it.
        </p>
      </div>
    </section>
  );
}
