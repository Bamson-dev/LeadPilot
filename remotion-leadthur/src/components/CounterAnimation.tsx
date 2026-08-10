import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants/theme";
import { fontFamily } from "./LeadThurLogo";

interface CounterAnimationProps {
  from: number;
  to: number;
  startFrame: number;
  duration?: number;
  suffix?: string;
  onCompleteColor?: string;
  style?: React.CSSProperties;
}

export const CounterAnimation: React.FC<CounterAnimationProps> = ({
  from,
  to,
  startFrame,
  duration = 60,
  suffix = "",
  onCompleteColor,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (localFrame < 0) {
    return (
      <span style={{ fontFamily, color: COLORS.white, ...style }}>
        {from.toLocaleString()}
        {suffix}
      </span>
    );
  }

  const progress = interpolate(localFrame, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const eased = 1 - Math.pow(1 - progress, 3);
  const current = Math.round(from + (to - from) * eased);
  const isComplete = localFrame >= duration;
  const displayValue = isComplete ? `${to.toLocaleString()}+` : current.toLocaleString();

  const blur = interpolate(localFrame, [0, duration * 0.7, duration], [0, 2, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowPulse =
    isComplete && onCompleteColor
      ? interpolate(
          localFrame - duration,
          [0, 8, 16],
          [0, 1, 0.4],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      : 0;

  const color = isComplete && onCompleteColor ? onCompleteColor : COLORS.white;

  return (
    <span
      style={{
        fontFamily,
        color,
        fontWeight: 800,
        filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
        textShadow:
          glowPulse > 0
            ? `0 0 ${30 * glowPulse}px ${onCompleteColor}, 0 0 ${60 * glowPulse}px rgba(16,185,129,0.3)`
            : undefined,
        ...style,
      }}
    >
      {displayValue}
      {!isComplete && suffix}
    </span>
  );
};
