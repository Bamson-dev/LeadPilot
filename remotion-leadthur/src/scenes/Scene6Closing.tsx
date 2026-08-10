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
import { fadeOpacity, fadeOutOpacity } from "../utils/animations";
import { fontFamily } from "../components/LeadThurLogo";

const SCENE_START = 2460;

const LINES = [
  { text: "1,000+ businesses. 60 seconds.", size: 24, color: COLORS.white, weight: 700 },
  { text: "Any city. 195 countries.", size: 16, color: COLORS.muted, weight: 400 },
  { text: "leadthur.com", size: 18, color: COLORS.purpleLight, weight: 700 },
] as const;

export const Scene6Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame: frame - SCENE_START,
    fps,
    config: SPRING_CONFIG,
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.9, 1.05]);

  const urlPulse =
    frame >= 2580
      ? 1 + Math.sin((frame - 2580) * 0.15) * 0.015
      : 1;

  const fadeToBlack = fadeOutOpacity(frame, 2685, 15);

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
      <div style={{ opacity: 1 - fadeToBlack, textAlign: "center" }}>
        <div style={{ marginBottom: 40 }}>
          <LeadThurLogo size="large" scale={logoScale} opacity={logoSpring} />
        </div>

        {LINES.map((line, i) => {
          const lineStart = SCENE_START + 20 + i * 15;
          const opacity = fadeOpacity(frame, lineStart, 15);
          const isUrl = i === 2;

          return (
            <div
              key={line.text}
              style={{
                fontSize: line.size,
                fontWeight: line.weight,
                color: line.color,
                opacity,
                marginTop: i === 0 ? 0 : 16,
                transform: isUrl && frame >= 2580 ? `scale(${urlPulse})` : undefined,
              }}
            >
              {line.text}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          opacity: fadeToBlack,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
