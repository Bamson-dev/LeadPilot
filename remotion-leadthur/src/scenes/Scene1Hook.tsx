import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LeadThurLogo } from "../components/LeadThurLogo";
import { COLORS, SPRING_CONFIG } from "../constants/theme";
import { fadeOpacity } from "../utils/animations";
import { fontFamily } from "../components/LeadThurLogo";

const BADGES = [
  { text: "60 seconds", color: COLORS.purple, textColor: COLORS.white, bg: "rgba(124,58,237,0.2)" },
  { text: "1,000+ contacts", color: COLORS.green, textColor: COLORS.green, bg: "rgba(16,185,129,0.12)" },
  { text: "195 countries", color: COLORS.border, textColor: COLORS.white, bg: COLORS.card },
] as const;

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.8, 1]);
  const logoOpacity = fadeOpacity(frame, 0, 20);

  const taglineOpacity = fadeOpacity(frame, 30, 20);

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
      }}
    >
      <LeadThurLogo opacity={logoOpacity} scale={logoScale} />

      <p
        style={{
          marginTop: 32,
          fontSize: 20,
          color: COLORS.muted,
          opacity: taglineOpacity,
          textAlign: "center",
          maxWidth: 600,
        }}
      >
        Watch what happens when you type any business in any city.
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 40,
        }}
      >
        {BADGES.map((badge, i) => {
          const badgeStart = 60 + i * 10;
          const badgeSpring = spring({
            frame: frame - badgeStart,
            fps,
            config: SPRING_CONFIG,
          });
          const translateY = interpolate(badgeSpring, [0, 1], [20, 0]);
          const opacity = fadeOpacity(frame, badgeStart, 12);

          return (
            <div
              key={badge.text}
              style={{
                opacity,
                transform: `translateY(${translateY}px)`,
                padding: "8px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                color: badge.textColor,
                background: badge.bg,
                border: `1px solid ${badge.color}`,
              }}
            >
              {badge.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
