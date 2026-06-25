import { C, FONT } from "./theme";

interface LeadThurLogoProps {
  size?: "sm" | "md";
}

export function LeadThurLogo({ size = "md" }: LeadThurLogoProps) {
  const icon = size === "sm" ? 36 : 40;
  const textSize = size === "sm" ? 18 : 20;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FONT }}>
      <div
        style={{
          width: icon,
          height: icon,
          background: C.purple,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: icon * 0.32,
          fontWeight: 800,
          color: "#fff",
        }}
      >
        LT
      </div>
      <span style={{ fontSize: textSize, fontWeight: 800, color: C.text, letterSpacing: -0.3 }}>
        Lead<span style={{ color: C.purpleLight }}>Thur</span>
      </span>
    </div>
  );
}
