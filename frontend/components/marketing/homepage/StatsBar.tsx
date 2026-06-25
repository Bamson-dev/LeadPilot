import { C, FONT } from "./theme";

const STATS = [
  { n: "1,000+", l: "Businesses per search" },
  { n: "60s", l: "Average search time" },
  { n: "195+", l: "Countries covered" },
  { n: "$0", l: "Monthly fee ever" },
];

export function StatsBar() {
  return (
    <section
      style={{
        backgroundColor: C.bg,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        }}
      >
        {STATS.map((s, i) => (
          <div
            key={s.l}
            style={{
              padding: "32px 24px",
              textAlign: "center",
              borderRight: i < STATS.length - 1 ? `1px solid ${C.border}` : "none",
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: C.purpleLight,
                letterSpacing: -1,
                marginBottom: 6,
              }}
            >
              {s.n}
            </div>
            <div style={{ fontSize: 13, color: C.muted }}>{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
