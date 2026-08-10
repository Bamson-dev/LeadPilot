import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants/theme";

const HOOK_TEXT = "Still searching for clients manually?";
const START = 0;
const END = 150;

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < START || frame >= END) return null;

  const localFrame = frame - START;

  // Cursor blink (frames 0-30)
  const showCursor = localFrame < 30 && Math.floor(localFrame / 15) % 2 === 0;

  // Typewriter (frames 30-90)
  const typeStart = 30;
  const charsToShow =
    localFrame < typeStart
      ? 0
      : Math.min(HOOK_TEXT.length, Math.floor((localFrame - typeStart) / 2) + 1);
  const typedText = HOOK_TEXT.slice(0, charsToShow);

  // Fade out (frames 90-120)
  const fadeOut = interpolate(localFrame, [90, 105], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slam in (frames 120-150)
  const slamProgress = spring({
    frame: localFrame - 120,
    fps,
    config: { mass: 0.5, damping: 12, stiffness: 120 },
  });
  const slamY = interpolate(slamProgress, [0, 1], [-80, 0]);
  const underlineWidth = interpolate(localFrame, [130, 150], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {localFrame < 90 && (
        <>
          {localFrame < 30 && showCursor && (
            <div
              style={{
                width: 3,
                height: 52,
                background: COLORS.white,
              }}
            />
          )}
          {localFrame >= 30 && (
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: COLORS.white,
                textAlign: "center",
                padding: "0 60px",
                lineHeight: 1.2,
                opacity: fadeOut,
              }}
            >
              {typedText}
              {charsToShow < HOOK_TEXT.length && (
                <span style={{ opacity: Math.floor(localFrame / 8) % 2 }}>|</span>
              )}
            </div>
          )}
        </>
      )}

      {localFrame >= 120 && (
        <div style={{ textAlign: "center", transform: `translateY(${slamY}px)`, opacity: slamProgress }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 900,
              color: COLORS.white,
              letterSpacing: -1,
            }}
          >
            There is a faster way.
          </div>
          <div
            style={{
              height: 4,
              background: COLORS.accent,
              borderRadius: 2,
              marginTop: 16,
              width: `${underlineWidth}%`,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          />
        </div>
      )}
    </AbsoluteFill>
  );
};
