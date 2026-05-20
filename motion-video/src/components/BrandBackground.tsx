import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { colors } from "../theme";

export const BrandBackground: React.FC<{
  pulse?: boolean;
  intensity?: number;
}> = ({ pulse = true, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const breathe = pulse
    ? interpolate(Math.sin(frame / 45), [-1, 1], [0.85, 1])
    : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: -120,
          width: 900,
          height: 520,
          transform: `translateX(-50%) scale(${1 + breathe * 0.04})`,
          borderRadius: "50%",
          background: `rgba(124, 58, 237, ${0.22 * intensity * breathe})`,
          filter: "blur(130px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -40,
          top: "28%",
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: `rgba(99, 102, 241, ${0.14 * intensity})`,
          filter: "blur(110px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -80,
          bottom: 40,
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: `rgba(217, 70, 239, ${0.1 * intensity})`,
          filter: "blur(90px)",
          transform: `translateX(${interpolate(Math.sin(frame / 60), [-1, 1], [-10, 24])}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(124,58,237,0.06), transparent 55%)",
        }}
      />
    </AbsoluteFill>
  );
};
