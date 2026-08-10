import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FEATURES } from "../constants/data";
import { COLORS } from "../constants/theme";
import { FeatureCard } from "../components/FeatureCard";

const START = 1500;
const END = 1950;

export const Features: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < START || frame >= END) return null;

  const localFrame = frame - START;

  const titleProgress = spring({
    frame: localFrame,
    fps,
    config: { mass: 0.5, damping: 15, stiffness: 100 },
  });

  const underlineWidth = interpolate(localFrame, [20, 50], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, sans-serif",
        padding: "80px 60px",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 48, opacity: titleProgress }}>
        <div
          style={{
            fontSize: 52,
            fontWeight: 900,
            color: COLORS.white,
            letterSpacing: -1,
          }}
        >
          Everything You Need
        </div>
        <div
          style={{
            height: 4,
            background: COLORS.accent,
            borderRadius: 2,
            marginTop: 12,
            width: `${underlineWidth}%`,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        {FEATURES.map((feature, i) => (
          <FeatureCard
            key={feature.title}
            icon={feature.icon}
            title={feature.title}
            desc={feature.desc}
            delay={60 + i * 60}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
