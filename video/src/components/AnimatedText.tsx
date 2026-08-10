import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants/theme";

type Direction = "up" | "down" | "left" | "right";

interface AnimatedTextProps {
  text: string;
  delay?: number;
  direction?: Direction;
  style?: React.CSSProperties;
}

const SPRING = { mass: 0.5, damping: 15, stiffness: 100 };

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  delay = 0,
  direction = "up",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: SPRING,
  });

  const offset = interpolate(progress, [0, 1], [40, 0]);

  const transforms: Record<Direction, string> = {
    up: `translateY(${offset}px)`,
    down: `translateY(${-offset}px)`,
    left: `translateX(${offset}px)`,
    right: `translateX(${-offset}px)`,
  };

  return (
    <div
      style={{
        opacity: progress,
        transform: transforms[direction],
        color: COLORS.white,
        fontFamily: "Inter, sans-serif",
        ...style,
      }}
    >
      {text}
    </div>
  );
};
