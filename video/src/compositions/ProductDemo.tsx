import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants/theme";
import { DashboardMockup } from "../components/DashboardMockup";
import { PulsingDot } from "../components/PulsingDot";

const START = 450;
const END = 1500;

const SEARCH_EXAMPLES = [
  { query: "restaurants", location: "Abuja, Nigeria", results: "1,000+" },
  { query: "law firms", location: "Accra, Ghana", results: "150+" },
  { query: "real estate", location: "London, UK", results: "300+" },
];

function typeText(text: string, localFrame: number, start: number, charsPerFrame = 0.5): string {
  const chars = Math.floor((localFrame - start) * charsPerFrame);
  return text.slice(0, Math.max(0, chars));
}

export const ProductDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < START || frame >= END) return null;

  const localFrame = frame - START;

  const searchBarProgress = spring({
    frame: localFrame,
    fps,
    config: { mass: 0.5, damping: 15, stiffness: 100 },
  });

  const businessType = typeText("dental clinics", localFrame, 30, 0.5);
  const location = typeText("Lagos, Nigeria", localFrame, 55, 0.5);

  const clickFrame = localFrame - 90;
  const rippleScale = interpolate(clickFrame, [0, 20], [0, 3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rippleOpacity = interpolate(clickFrame, [0, 20], [0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const searchingText =
    localFrame < 130 ? "Searching..." : localFrame < 150 ? "Found 1 business" : null;

  const dashboardStart = 150;
  const showDashboard = localFrame >= dashboardStart && localFrame < 750;

  const businessCount = Math.min(
    147,
    Math.floor(interpolate(localFrame, [dashboardStart, dashboardStart + 280], [1, 147], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }))
  );

  const zoomPhase = localFrame >= 450 && localFrame < 570;
  const zoomScale = zoomPhase
    ? localFrame < 510
      ? interpolate(localFrame, [450, 510], [1, 1.08], { extrapolateRight: "clamp" })
      : interpolate(localFrame, [510, 570], [1.08, 1], { extrapolateRight: "clamp" })
    : 1;

  const highlightEmail = localFrame >= 450 && localFrame < 510;
  const highlightPhone = localFrame >= 510 && localFrame < 570;
  const showExportPulse = localFrame >= 570 && localFrame < 630;

  const dashboardSlideOut = interpolate(localFrame, [630, 690], [0, -1200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const csvFall = localFrame >= 690 && localFrame < 750;
  const csvY = csvFall
    ? interpolate(localFrame, [690, 720], [-200, 0], { extrapolateRight: "clamp" })
    : localFrame >= 720
      ? 0
      : -200;
  const csvRotate = csvFall
    ? interpolate(localFrame, [690, 720], [-15, 0], { extrapolateRight: "clamp" })
    : 0;

  const csvTextOpacity = interpolate(localFrame, [720, 750], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const examplesStart = 750;
  const exampleIndex = Math.min(
    2,
    Math.floor((localFrame - examplesStart) / 100)
  );
  const exampleLocal = (localFrame - examplesStart) % 100;
  const slideX = interpolate(exampleLocal, [0, 15, 85, 100], [1080, 0, 0, -1080], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const labelOpacity = (start: number, end: number) =>
    interpolate(localFrame, [start, start + 15, end - 15, end], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, sans-serif",
        padding: "60px 40px",
      }}
    >
      {/* Search bar phase */}
      {localFrame < 750 && (
        <>
          <div
            style={{
              opacity: searchBarProgress,
              transform: `translateY(${interpolate(searchBarProgress, [0, 1], [-60, 0])}px)`,
              marginBottom: 32,
            }}
          >
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.accent}66`,
                borderRadius: 16,
                padding: "20px 24px",
                maxWidth: 700,
                margin: "0 auto",
              }}
            >
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>
                Business type
              </div>
              <div style={{ fontSize: 22, color: COLORS.white, fontWeight: 600, marginBottom: 16, minHeight: 28 }}>
                {businessType || "Type any business..."}
              </div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>
                Location
              </div>
              <div style={{ fontSize: 18, color: COLORS.accentLight, minHeight: 24 }}>{location}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: 20, position: "relative" }}>
              <div
                style={{
                  background: COLORS.accent,
                  color: COLORS.white,
                  padding: "14px 48px",
                  borderRadius: 12,
                  fontSize: 18,
                  fontWeight: 700,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                Search
                {clickFrame >= 0 && clickFrame < 25 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "rgba(124,58,237,0.3)",
                      transform: `translate(-50%, -50%) scale(${rippleScale})`,
                      opacity: rippleOpacity,
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {searchingText && localFrame >= 120 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <PulsingDot />
              <span style={{ color: COLORS.white, fontSize: 16, fontWeight: 600 }}>{searchingText}</span>
            </div>
          )}

          {showDashboard && (
            <div
              style={{
                transform: `translateY(${dashboardSlideOut}px) scale(${zoomScale})`,
                transformOrigin: "center center",
                position: "relative",
              }}
            >
              <DashboardMockup
                startFrame={START + dashboardStart}
                rowDelay={40}
                businessCount={businessCount}
                highlightColumn={highlightEmail ? "email" : highlightPhone ? "phone" : null}
                showExportPulse={showExportPulse}
              />

              {highlightEmail && (
                <div
                  style={{
                    position: "absolute",
                    bottom: -50,
                    left: "50%",
                    transform: "translateX(-50%)",
                    color: COLORS.white,
                    fontSize: 18,
                    opacity: labelOpacity(450, 510),
                    whiteSpace: "nowrap",
                  }}
                >
                  Real emails pulled from their website
                </div>
              )}
              {highlightPhone && (
                <div
                  style={{
                    position: "absolute",
                    bottom: -50,
                    left: "50%",
                    transform: "translateX(-50%)",
                    color: COLORS.white,
                    fontSize: 18,
                    opacity: labelOpacity(510, 570),
                    whiteSpace: "nowrap",
                  }}
                >
                  Direct phone number. Call or WhatsApp.
                </div>
              )}
              {showExportPulse && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 20,
                    color: COLORS.white,
                    fontSize: 18,
                    opacity: labelOpacity(570, 630),
                  }}
                >
                  Export everything in one click. →
                </div>
              )}
            </div>
          )}

          {localFrame >= 690 && localFrame < 750 && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, calc(-50% + ${csvY}px)) rotate(${csvRotate}deg)`,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 80 }}>📄</div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: COLORS.white,
                  marginTop: 20,
                  opacity: csvTextOpacity,
                }}
              >
                Your leads. Downloaded. Ready to pitch.
              </div>
            </div>
          )}
        </>
      )}

      {/* Rotating search examples */}
      {localFrame >= examplesStart && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `translateX(${slideX}px)`,
          }}
        >
          <div
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.accent}44`,
              borderRadius: 20,
              padding: "48px 56px",
              textAlign: "center",
              width: "80%",
            }}
          >
            <div style={{ fontSize: 14, color: COLORS.muted, marginBottom: 12 }}>Search anywhere</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.white, marginBottom: 8 }}>
              {SEARCH_EXAMPLES[exampleIndex].query}
            </div>
            <div style={{ fontSize: 22, color: COLORS.accentLight, marginBottom: 24 }}>
              in {SEARCH_EXAMPLES[exampleIndex].location}
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: COLORS.green,
              }}
            >
              {SEARCH_EXAMPLES[exampleIndex].results} results
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
