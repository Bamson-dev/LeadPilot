import React from "react";
import { colors, font } from "../theme";

export const Logo: React.FC<{ size?: "sm" | "lg"; subtitle?: string }> = ({
  size = "lg",
  subtitle,
}) => {
  const mainSize = size === "lg" ? 72 : 36;
  return (
    <div style={{ textAlign: "center", fontFamily: font }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: size === "lg" ? 16 : 10,
        }}
      >
        <div
          style={{
            width: size === "lg" ? 64 : 36,
            height: size === "lg" ? 64 : 36,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${colors.violet}, ${colors.indigo})`,
            boxShadow: "0 0 48px rgba(124,58,237,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size === "lg" ? 28 : 16,
            fontWeight: 800,
            color: colors.white,
          }}
        >
          LP
        </div>
        <span
          style={{
            fontSize: mainSize,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: colors.white,
          }}
        >
          Lead<span style={{ color: colors.violetLight }}>Pilot</span>
        </span>
      </div>
      {subtitle ? (
        <p
          style={{
            marginTop: size === "lg" ? 20 : 10,
            fontSize: size === "lg" ? 22 : 14,
            color: colors.muted,
            fontWeight: 500,
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
};
