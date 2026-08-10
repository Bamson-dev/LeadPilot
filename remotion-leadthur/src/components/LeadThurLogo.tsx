import React from "react";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont();

export { fontFamily };

interface LeadThurLogoProps {
  size?: "normal" | "large";
  opacity?: number;
  scale?: number;
}

export const LeadThurLogo: React.FC<LeadThurLogoProps> = ({
  size = "normal",
  opacity = 1,
  scale = 1,
}) => {
  const iconSize = size === "large" ? 56 : 48;
  const fontSize = size === "large" ? 36 : 32;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        opacity,
        transform: `scale(${scale})`,
        fontFamily,
      }}
    >
      <div
        style={{
          width: iconSize,
          height: iconSize,
          background: "#7C3AED",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: iconSize * 0.32,
          fontWeight: 800,
          color: "#FFFFFF",
        }}
      >
        LT
      </div>
      <span
        style={{
          fontSize,
          fontWeight: 700,
          color: "#FFFFFF",
          letterSpacing: -0.5,
        }}
      >
        LeadThur
      </span>
    </div>
  );
};
