import { C, FONT } from "./theme";

export function StatsBar() {
  return (
    <section
      style={{
        backgroundColor: C.bg,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        fontFamily: FONT,
        padding: "24px 16px",
      }}
    >
      <p
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: "clamp(14px, 3.5vw, 16px)",
          fontWeight: 700,
          color: C.purpleLight,
          lineHeight: 1.6,
        }}
      >
        5,111 found this week. 60 seconds to first result. 195+ countries. 0% commission taken.
      </p>
    </section>
  );
}
