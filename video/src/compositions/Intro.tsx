import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { STATS } from "../constants/data";
import { COLORS } from "../constants/theme";
import { CounterAnimation } from "../components/CounterAnimation";

const START = 150;
const END = 450;

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < START || frame >= END) return null;

  const localFrame = frame - START;

  const logoProgress = spring({
    frame: localFrame,
    fps,
    config: { mass: 0.5, damping: 15, stiffness: 100 },
  });

  const taglineWords = ["Find", "10,000+", "Businesses.", "In", "Seconds."];
  const taglineStart = 50;

  const pillStart = 130;
  const pillStats = STATS.slice(0, 3);

  const watermarkStart = 210;
  const watermarkProgress = interpolate(localFrame, [watermarkStart, 240], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoScale = interpolate(watermarkProgress, [0, 1], [1, 0.45]);
  const logoX = interpolate(watermarkProgress, [0, 1], [0, -380]);
  const logoY = interpolate(watermarkProgress, [0, 1], [0, -380]);

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Watermark persists after intro ends — handled in Root via separate watermark layer */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(calc(-50% + ${logoX}px), calc(-50% + ${logoY}px)) scale(${localFrame >= watermarkStart ? logoScale : logoProgress})`,
          display: "flex",
          alignItems: "center",
          gap: 16,
          opacity: logoProgress,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            background: COLORS.accent,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 900,
            color: COLORS.white,
          }}
        >
          LT
        </div>
        <div>
          <div style={{ fontSize: 48, fontWeight: 800, color: COLORS.white, lineHeight: 1 }}>
            Lead<span style={{ color: COLORS.accentLight }}>Thur</span>
          </div>
          <div
            style={{
              fontSize: 10,
              color: COLORS.muted,
              letterSpacing: 3,
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            Business Discovery
          </div>
        </div>
      </div>

      {localFrame >= taglineStart && localFrame < watermarkStart + 30 && (
        <div
          style={{
            position: "absolute",
            top: "58%",
            left: 0,
            right: 0,
            textAlign: "center",
            padding: "0 40px",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
            {taglineWords.map((word, i) => {
              const wordProgress = spring({
                frame: localFrame - taglineStart - i * 8,
                fps,
                config: { mass: 0.5, damping: 15, stiffness: 100 },
              });
              return (
                <span
                  key={word}
                  style={{
                    fontSize: 36,
                    fontWeight: 700,
                    color: COLORS.white,
                    opacity: wordProgress,
                    transform: `translateY(${interpolate(wordProgress, [0, 1], [20, 0])}px)`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {localFrame >= pillStart && localFrame < watermarkStart + 60 && (
        <div
          style={{
            position: "absolute",
            bottom: 120,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
            padding: "0 40px",
          }}
        >
          {pillStats.map((stat, i) => {
            const pillProgress = spring({
              frame: localFrame - pillStart - i * 30,
              fps,
              config: { mass: 0.5, damping: 15, stiffness: 100 },
            });
            return (
              <div
                key={stat.label}
                style={{
                  border: `1px solid ${COLORS.accent}`,
                  borderRadius: 40,
                  padding: "14px 28px",
                  opacity: pillProgress,
                  transform: `translateY(${interpolate(pillProgress, [0, 1], [40, 0])}px)`,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  <CounterAnimation value={stat.number} duration={25} />
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{stat.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Logo watermark shown from frame 360 onward across remaining scenes */
export const LogoWatermark: React.FC = () => {
  const frame = useCurrentFrame();

  if (frame < 360) return null;

  const pulseOnce = frame >= 2580 && frame < 2620
    ? interpolate(frame - 2580, [0, 20, 40], [1, 1.08, 1])
    : 1;

  return (
    <div
      style={{
        position: "absolute",
        top: 28,
        left: 28,
        display: "flex",
        alignItems: "center",
        gap: 10,
        zIndex: 100,
        transform: `scale(${pulseOnce})`,
        opacity: 0.85,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          background: COLORS.accent,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 900,
          color: COLORS.white,
        }}
      >
        LT
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.white }}>
        Lead<span style={{ color: COLORS.accentLight }}>Thur</span>
      </div>
    </div>
  );
};
