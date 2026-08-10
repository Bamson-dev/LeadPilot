import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { AnimatedCursor, cursorPosition } from "../components/AnimatedCursor";
import { BrowserMockup } from "../components/BrowserMockup";
import { TypedText } from "../components/TypedText";
import { COLORS } from "../constants/theme";
import { fontFamily } from "../components/LeadThurLogo";

const BUSINESS_TYPE = "Restaurants";
const CITY = "Lagos";

export const Scene2Search: React.FC = () => {
  const frame = useCurrentFrame();

  const isLoading = frame >= 380 && frame < 410;
  const loadingDone = frame >= 410;
  const progressWidth = interpolate(frame, [380, 410], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const clickFrame = 370;
  const buttonScale = interpolate(
    frame,
    [clickFrame, clickFrame + 3, clickFrame + 6],
    [1, 0.95, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const rippleOpacity = interpolate(
    frame,
    [clickFrame, clickFrame + 6, clickFrame + 20],
    [0, 0.6, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const cursor = cursorPosition(frame, [
    { frame: 250, x: 520, y: 340 },
    { frame: 320, x: 920, y: 340 },
    { frame: 370, x: 1180, y: 420 },
    { frame: 410, x: 1180, y: 420 },
  ]);

  const clicking = frame >= clickFrame && frame < clickFrame + 6;
  const showCursor = frame >= 250 && frame < 410;

  const spinnerRotation = (frame - 380) * 12;

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
      <BrowserMockup>
        <div style={{ padding: 48 }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.white,
              marginBottom: 8,
            }}
          >
            Find Business Contacts
          </h2>
          <p style={{ fontSize: 14, color: COLORS.muted, marginBottom: 32 }}>
            Search any business type in any city worldwide.
          </p>

          <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: COLORS.muted,
                  marginBottom: 8,
                  fontWeight: 600,
                }}
              >
                Business Type
              </label>
              <div
                style={{
                  background: COLORS.card,
                  border: `1px solid ${frame >= 250 && frame < 320 ? COLORS.purple : COLORS.border}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  fontSize: 16,
                  color: COLORS.white,
                  minHeight: 50,
                  boxShadow:
                    frame >= 250 && frame < 320
                      ? "0 0 0 3px rgba(124,58,237,0.15)"
                      : "none",
                }}
              >
                {frame >= 250 ? (
                  <TypedText
                    text={BUSINESS_TYPE}
                    startFrame={250}
                    charDelay={3}
                    cursorEndFrame={320}
                  />
                ) : null}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: COLORS.muted,
                  marginBottom: 8,
                  fontWeight: 600,
                }}
              >
                City
              </label>
              <div
                style={{
                  background: COLORS.card,
                  border: `1px solid ${frame >= 320 && frame < 370 ? COLORS.purple : COLORS.border}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  fontSize: 16,
                  color: COLORS.white,
                  minHeight: 50,
                  boxShadow:
                    frame >= 320 && frame < 370
                      ? "0 0 0 3px rgba(124,58,237,0.15)"
                      : "none",
                }}
              >
                {frame >= 320 ? (
                  <TypedText
                    text={CITY}
                    startFrame={320}
                    charDelay={3}
                    cursorEndFrame={370}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              style={{
                background: COLORS.purple,
                color: COLORS.white,
                border: "none",
                borderRadius: 12,
                padding: "16px 48px",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                transform: `scale(${buttonScale})`,
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontFamily,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {isLoading ? (
                <>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: COLORS.white,
                      borderRadius: "50%",
                      transform: `rotate(${spinnerRotation}deg)`,
                    }}
                  />
                  Searching...
                </>
              ) : loadingDone ? (
                "Search Complete"
              ) : (
                "Search Now"
              )}
            </button>
            {rippleOpacity > 0 && (
              <div
                style={{
                  position: "absolute",
                  inset: -8,
                  borderRadius: 16,
                  border: `2px solid ${COLORS.purple}`,
                  opacity: rippleOpacity,
                  pointerEvents: "none",
                }}
              />
            )}
          </div>

          {(isLoading || loadingDone) && (
            <div style={{ marginTop: 20, width: 400 }}>
              <div
                style={{
                  height: 4,
                  background: COLORS.card,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${loadingDone ? 100 : progressWidth}%`,
                    height: "100%",
                    background: COLORS.purple,
                    borderRadius: 4,
                    boxShadow: "0 0 12px rgba(124,58,237,0.5)",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {showCursor && (
          <AnimatedCursor
            x={cursor.x}
            y={cursor.y}
            clicking={clicking}
          />
        )}
      </BrowserMockup>
    </AbsoluteFill>
  );
};
