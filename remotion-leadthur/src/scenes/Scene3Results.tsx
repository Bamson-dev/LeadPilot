import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BrowserMockup } from "../components/BrowserMockup";
import { CounterAnimation } from "../components/CounterAnimation";
import { ResultRow, ResultsTableHeader } from "../components/ResultRow";
import { LAGOS_RESTAURANTS } from "../constants/data";
import { COLORS } from "../constants/theme";
import { fadeOpacity } from "../utils/animations";
import { fontFamily } from "../components/LeadThurLogo";

const SCENE_START = 840;

export const Scene3Results: React.FC = () => {
  const frame = useCurrentFrame();
  const localFrame = frame - SCENE_START;

  const slideUp = interpolate(localFrame, [0, 20], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tableOpacity = fadeOpacity(frame, SCENE_START, 20);

  const showCounter = frame >= 960;
  const counterLabelOpacity = fadeOpacity(frame, 1020, 15);

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
        <div
          style={{
            padding: "24px 28px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            opacity: tableOpacity,
            transform: `translateY(${slideUp}px)`,
          }}
        >
          {showCounter && (
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 56, lineHeight: 1.1 }}>
                <CounterAnimation
                  from={12}
                  to={1000}
                  startFrame={960}
                  duration={60}
                  onCompleteColor={COLORS.green}
                />
              </div>
              <div
                style={{
                  fontSize: 16,
                  color: COLORS.muted,
                  marginTop: 8,
                  opacity: counterLabelOpacity,
                }}
              >
                businesses found
              </div>
            </div>
          )}

          <div
            style={{
              flex: 1,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              overflow: "hidden",
              background: COLORS.background,
            }}
          >
            <ResultsTableHeader />
            <div style={{ maxHeight: showCounter ? 520 : 620, overflow: "hidden" }}>
              {LAGOS_RESTAURANTS.map((result, index) => (
                <ResultRow
                  key={result.name}
                  result={result}
                  index={index}
                  appearFrame={SCENE_START + index * 4}
                />
              ))}
            </div>
          </div>
        </div>
      </BrowserMockup>
    </AbsoluteFill>
  );
};
