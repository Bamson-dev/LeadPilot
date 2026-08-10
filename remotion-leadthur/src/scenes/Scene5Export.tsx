import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { AnimatedCursor, cursorPosition } from "../components/AnimatedCursor";
import { BrowserMockup } from "../components/BrowserMockup";
import { CounterAnimation } from "../components/CounterAnimation";
import { ResultRow, ResultsTableHeader } from "../components/ResultRow";
import { SpreadsheetView } from "../components/SpreadsheetView";
import { LAGOS_RESTAURANTS } from "../constants/data";
import { COLORS } from "../constants/theme";
import { fadeOpacity } from "../utils/animations";
import { fontFamily } from "../components/LeadThurLogo";

const SCENE_START = 2160;

export const Scene5Export: React.FC = () => {
  const frame = useCurrentFrame();
  const localFrame = frame - SCENE_START;

  const clickFrame = SCENE_START + 40;
  const clicking = frame >= clickFrame && frame < clickFrame + 6;
  const buttonScale = interpolate(
    frame,
    [clickFrame, clickFrame + 3, clickFrame + 6],
    [1, 0.95, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const downloadProgress = interpolate(
    frame,
    [clickFrame + 10, clickFrame + 30],
    [0, 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const fileLanded = frame >= clickFrame + 30;
  const fileY = interpolate(
    frame,
    [clickFrame + 10, clickFrame + 30],
    [200, 680],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const splitStart = clickFrame + 35;
  const showSplit = frame >= splitStart;
  const splitProgress = interpolate(
    frame,
    [splitStart, splitStart + 30],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const caption1Opacity = fadeOpacity(frame, 2260, 15);
  const caption2Opacity = fadeOpacity(frame, 2275, 15);

  const cursor = cursorPosition(frame, [
    { frame: SCENE_START + 20, x: 1180, y: 180 },
    { frame: clickFrame, x: 1180, y: 180 },
    { frame: clickFrame + 30, x: 960, y: 700 },
  ]);

  const showCursor = frame >= SCENE_START + 20 && frame < clickFrame + 35;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily,
      }}
    >
      {!showSplit ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <BrowserMockup>
            <div style={{ padding: "20px 24px", position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 40, fontWeight: 800, color: COLORS.green }}>
                    <CounterAnimation
                      from={1000}
                      to={1000}
                      startFrame={SCENE_START}
                      duration={1}
                      onCompleteColor={COLORS.green}
                    />
                  </div>
                  <div style={{ fontSize: 14, color: COLORS.muted }}>businesses found</div>
                </div>
                <button
                  style={{
                    background: frame >= clickFrame ? COLORS.green : COLORS.card,
                    color: COLORS.white,
                    border: `1px solid ${COLORS.green}`,
                    borderRadius: 10,
                    padding: "10px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transform: `scale(${buttonScale})`,
                    fontFamily,
                  }}
                >
                  <span>⬇</span> Export to CSV
                </button>
              </div>

              <div
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <ResultsTableHeader />
                {LAGOS_RESTAURANTS.map((result, index) => (
                  <ResultRow
                    key={result.name}
                    result={result}
                    index={index}
                    appearFrame={SCENE_START - 1}
                  />
                ))}
              </div>
            </div>

            {showCursor && (
              <AnimatedCursor x={cursor.x} y={cursor.y} clicking={clicking} />
            )}
          </BrowserMockup>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: "40px 80px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 24,
              width: "100%",
              height: 620,
              opacity: splitProgress,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <BrowserMockup url="leadthur.com">
                <div style={{ padding: 16, transform: "scale(0.85)", transformOrigin: "top left" }}>
                  <ResultsTableHeader />
                  {LAGOS_RESTAURANTS.slice(0, 8).map((result, index) => (
                    <ResultRow
                      key={result.name}
                      result={result}
                      index={index}
                      appearFrame={SCENE_START - 1}
                    />
                  ))}
                </div>
              </BrowserMockup>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SpreadsheetView
                data={LAGOS_RESTAURANTS}
                populateStartFrame={splitStart}
                populateDuration={30}
              />
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 32 }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: COLORS.white,
                opacity: caption1Opacity,
              }}
            >
              1,000+ contacts. Downloaded. Ready to pitch.
            </div>
            <div
              style={{
                fontSize: 16,
                color: COLORS.green,
                marginTop: 8,
                opacity: caption2Opacity,
              }}
            >
              Same morning you searched.
            </div>
          </div>
        </div>
      )}

      {frame >= clickFrame + 10 && frame < splitStart + 5 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: fileY,
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: 48,
              height: 56,
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              📄
            </div>
            <div
              style={{
                height: 4,
                background: "#0D0B18",
              }}
            >
              <div
                style={{
                  width: `${downloadProgress}%`,
                  height: "100%",
                  background: COLORS.green,
                }}
              />
            </div>
          </div>
          {fileLanded && (
            <>
              <span style={{ color: COLORS.white, fontSize: 14 }}>
                leads-lagos-restaurants.csv
              </span>
              <span style={{ color: COLORS.green, fontSize: 20 }}>✓</span>
            </>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
