import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants/theme";
import { SPRING_CONFIG } from "../constants/theme";
import { BusinessResult } from "../constants/data";
import { fontFamily } from "./LeadThurLogo";

interface ResultRowProps {
  result: BusinessResult;
  index: number;
  appearFrame: number;
}

export const ResultRow: React.FC<ResultRowProps> = ({
  result,
  index,
  appearFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - appearFrame;

  if (localFrame < 0) return null;

  const entrance = spring({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG,
  });

  const opacity = interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(entrance, [0, 1], [-12, 0]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr 1.2fr 1fr 0.6fr",
        padding: "12px 20px",
        borderBottom: `1px solid ${COLORS.border}`,
        background: index % 2 === 0 ? COLORS.card : "#141028",
        opacity,
        transform: `translateY(${translateY}px)`,
        fontFamily,
        fontSize: 13,
        alignItems: "center",
      }}
    >
      <div style={{ color: COLORS.white, fontWeight: 600 }}>{result.name}</div>
      <div style={{ color: COLORS.green }}>{result.phone}</div>
      <div style={{ color: COLORS.purpleLight }}>{result.email}</div>
      <div style={{ color: COLORS.purple }}>{result.website}</div>
      <div style={{ color: "#F59E0B", fontWeight: 600 }}>★ {result.rating}</div>
    </div>
  );
};

export const ResultsTableHeader: React.FC = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1.4fr 1fr 1.2fr 1fr 0.6fr",
      padding: "10px 20px",
      background: "#0D0B18",
      borderBottom: `1px solid ${COLORS.border}`,
      fontFamily,
      fontSize: 11,
      fontWeight: 700,
      color: COLORS.muted,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
    }}
  >
    <div>Business Name</div>
    <div>Phone Number</div>
    <div>Email</div>
    <div>Website</div>
    <div>Google Rating</div>
  </div>
);
