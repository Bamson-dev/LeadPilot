import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DataPill } from "../components/DataPill";
import { FEATURED_BUSINESS } from "../constants/data";
import { COLORS, SPRING_CONFIG } from "../constants/theme";
import { fadeOpacity } from "../utils/animations";
import { fontFamily } from "../components/LeadThurLogo";

const SCENE_START = 1800;
const WORDS = ["Every", "business.", "Every", "contact.", "Ready", "to", "use."];

export const Scene4BusinessDetail: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - SCENE_START;

  const expandSpring = spring({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG,
  });
  const scale = interpolate(expandSpring, [0, 1], [0.85, 1]);

  const shimmerStart = 1860;
  const shimmerProgress = interpolate(
    frame,
    [shimmerStart, shimmerStart + 40],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const pills = [
    { value: FEATURED_BUSINESS.phone, variant: "purple" as const },
    { value: FEATURED_BUSINESS.email, variant: "card" as const },
    { value: FEATURED_BUSINESS.website, variant: "card" as const },
    {
      value: `${FEATURED_BUSINESS.rating} ★`,
      variant: "green" as const,
    },
  ];

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
      }}
    >
      <div
        style={{
          width: 1100,
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          padding: 48,
          transform: `scale(${scale})`,
          opacity: expandSpring,
          boxShadow: "0 40px 100px rgba(0,0,0,0.5)",
        }}
      >
        {[
          {
            content: (
              <h2
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: COLORS.white,
                  margin: 0,
                }}
              >
                {FEATURED_BUSINESS.name}
              </h2>
            ),
            delay: 0,
          },
          {
            content: (
              <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
                {pills.map((pill, i) => {
                  const pillShimmer = Math.max(
                    0,
                    Math.min(1, (shimmerProgress - i * 0.2) * 2)
                  );
                  return (
                    <DataPill
                      key={pill.value}
                      value={pill.value}
                      variant={pill.variant}
                      shimmerOffset={frame >= shimmerStart ? pillShimmer : -1}
                    />
                  );
                })}
              </div>
            ),
            delay: 10,
          },
          {
            content: (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 24,
                  color: COLORS.muted,
                  fontSize: 16,
                }}
              >
                <span style={{ fontSize: 18 }}>📍</span>
                Victoria Island, Lagos, Nigeria
              </div>
            ),
            delay: 20,
          },
        ].map((section, i) => {
          const sectionOpacity = fadeOpacity(frame, SCENE_START + section.delay, 15);
          return (
            <div key={i} style={{ opacity: sectionOpacity }}>
              {section.content}
            </div>
          );
        })}

        <div
          style={{
            marginTop: 36,
            fontSize: 18,
            fontWeight: 600,
            color: COLORS.purpleLight,
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 8px",
          }}
        >
          {WORDS.map((word, i) => {
            const wordStart = 1900 + i * 5;
            const wordOpacity = fadeOpacity(frame, wordStart, 8);
            return (
              <span key={i} style={{ opacity: wordOpacity }}>
                {word}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
