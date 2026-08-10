import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants/theme";

interface FeatureCardProps {
  icon: string;
  title: string;
  desc: string;
  delay?: number;
}

const SPRING = { mass: 0.5, damping: 15, stiffness: 100 };

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  desc,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardProgress = spring({
    frame: frame - delay,
    fps,
    config: SPRING,
  });

  const scale = interpolate(cardProgress, [0, 1], [0.8, 1]);
  const iconProgress = spring({
    frame: frame - delay - 10,
    fps,
    config: { ...SPRING, stiffness: 200 },
  });
  const titleProgress = spring({
    frame: frame - delay - 20,
    fps,
    config: SPRING,
  });
  const descProgress = spring({
    frame: frame - delay - 30,
    fps,
    config: SPRING,
  });

  const iconBounce = interpolate(iconProgress, [0, 1], [0.5, 1]);

  return (
    <div
      style={{
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.accent}44`,
        borderRadius: 16,
        padding: "28px 24px",
        opacity: cardProgress,
        transform: `scale(${scale})`,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 36,
          marginBottom: 12,
          transform: `scale(${iconBounce})`,
          opacity: iconProgress,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.white,
          marginBottom: 8,
          opacity: titleProgress,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 14,
          color: COLORS.muted,
          lineHeight: 1.5,
          opacity: descProgress,
        }}
      >
        {desc}
      </div>
    </div>
  );
};
