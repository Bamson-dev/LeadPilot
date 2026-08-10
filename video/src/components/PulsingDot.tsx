import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants/theme";

interface PulsingDotProps {
  size?: number;
}

export const PulsingDot: React.FC<PulsingDotProps> = ({ size = 10 }) => {
  const frame = useCurrentFrame();
  const cycle = frame % 60;
  const scale = interpolate(cycle, [0, 30, 60], [1, 1.4, 1]);
  const opacity = interpolate(cycle, [0, 30, 60], [1, 0.5, 1]);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: COLORS.green,
        transform: `scale(${scale})`,
        opacity,
        flexShrink: 0,
      }}
    />
  );
};
