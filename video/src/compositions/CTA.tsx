import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants/theme";

const START = 2250;
const END = 2700;

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < START) return null;

  const localFrame = frame - START;

  const headlineProgress = spring({
    frame: localFrame,
    fps,
    config: { mass: 0.5, damping: 12, stiffness: 120 },
  });

  const secondLineProgress = spring({
    frame: localFrame - 60,
    fps,
    config: { mass: 0.5, damping: 15, stiffness: 100 },
  });

  const subheadlineProgress = spring({
    frame: localFrame - 90,
    fps,
    config: { mass: 0.5, damping: 15, stiffness: 100 },
  });

  const strikeWidth = interpolate(localFrame, [120, 140], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const priceOpacity = interpolate(localFrame, [130, 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const buttonProgress = spring({
    frame: localFrame - 180,
    fps,
    config: { mass: 0.5, damping: 10, stiffness: 100 },
  });

  const buttonScale =
    localFrame >= 180
      ? buttonProgress * interpolate((localFrame - 180) % 30, [0, 15, 30], [1, 1.03, 1])
      : interpolate(buttonProgress, [0, 1], [0, 1]);

  const urlOpacity = interpolate(localFrame, [270, 300], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const arrowOpacity = interpolate(localFrame, [290, 310], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, sans-serif",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Floating particles */}
      {localFrame >= 330 &&
        Array.from({ length: 12 }).map((_, i) => {
          const particleY = ((localFrame - 330 + i * 40) * 1.5) % 1200;
          const particleX = 100 + (i * 80) % 880;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: particleX,
                bottom: -20 + (1080 - particleY),
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: COLORS.accent,
                opacity: 0.3,
              }}
            />
          );
        })}

      <div style={{ textAlign: "center", padding: "0 60px", zIndex: 1 }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: COLORS.white,
            letterSpacing: -1,
            opacity: headlineProgress,
            transform: `translateY(${interpolate(headlineProgress, [0, 1], [-40, 0])}px)`,
            marginBottom: 16,
          }}
        >
          Find Clients Anywhere.
        </div>

        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: COLORS.accentLight,
            opacity: secondLineProgress,
            transform: `translateY(${interpolate(secondLineProgress, [0, 1], [30, 0])}px)`,
            marginBottom: 24,
          }}
        >
          In Seconds. Worldwide.
        </div>

        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: COLORS.muted,
            opacity: subheadlineProgress,
            transform: `translateY(${interpolate(subheadlineProgress, [0, 1], [20, 0])}px)`,
            marginBottom: 40,
          }}
        >
          195 Countries. Any City. Any Niche.
        </div>

        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              fontSize: 22,
              color: COLORS.muted,
              position: "relative",
              display: "inline-block",
              marginBottom: 12,
              opacity: priceOpacity,
            }}
          >
            Apollo: $588/yr
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                height: 2,
                background: COLORS.muted,
                width: `${strikeWidth}%`,
              }}
            />
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: COLORS.white,
              opacity: priceOpacity,
            }}
          >
            LeadThur:{" "}
            <span
              style={{
                textShadow: "0 0 20px rgba(255,255,255,0.4)",
              }}
            >
              $25 once.
            </span>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "inline-block",
            opacity: buttonProgress,
            transform: `scale(${buttonScale})`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: -20,
              background: COLORS.accentGlow,
              borderRadius: 20,
              filter: "blur(20px)",
              opacity: localFrame >= 180 ? interpolate((localFrame - 180) % 30, [0, 15, 30], [0.5, 1, 0.5]) : 0,
            }}
          />
          <div
            style={{
              background: COLORS.accent,
              color: COLORS.white,
              padding: "22px 48px",
              borderRadius: 16,
              fontSize: 36,
              fontWeight: 800,
              position: "relative",
              boxShadow: `0 8px 32px ${COLORS.accentGlow}`,
            }}
          >
            Get Lifetime Access — $25
          </div>
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 18,
            color: COLORS.white,
            opacity: urlOpacity,
            lineHeight: 1.5,
          }}
        >
          One payment. No monthly fee. No renewal. Access forever.
        </div>

        <div
          style={{
            marginTop: 16,
            fontSize: 16,
            fontWeight: 700,
            color: COLORS.accentLight,
            opacity: arrowOpacity,
          }}
        >
          Lifetime Deal — Lock In Your Access Before Price Goes Up
        </div>
      </div>
    </AbsoluteFill>
  );
};
