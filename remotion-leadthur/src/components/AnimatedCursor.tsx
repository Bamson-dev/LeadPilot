import React from "react";
import { Easing, interpolate } from "remotion";

interface AnimatedCursorProps {
  x: number;
  y: number;
  clicking?: boolean;
  visible?: boolean;
}

export const AnimatedCursor: React.FC<AnimatedCursorProps> = ({
  x,
  y,
  clicking = false,
  visible = true,
}) => {
  if (!visible) return null;

  const scale = clicking ? 0.85 : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 24,
        height: 24,
        pointerEvents: "none",
        zIndex: 9999,
        transform: `scale(${scale})`,
        transition: "transform 0.05s",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={24}
        height={24}
        fill="white"
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.8))" }}
      >
        <path d="M4 0 L4 20 L8 16 L12 24 L14 23 L10 15 L16 15 Z" />
      </svg>
      {clicking && (
        <div
          style={{
            position: "absolute",
            left: 4,
            top: 4,
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "2px solid rgba(124,58,237,0.8)",
            animation: "none",
          }}
        />
      )}
    </div>
  );
};

export function cursorPosition(
  frame: number,
  waypoints: Array<{ frame: number; x: number; y: number }>
): { x: number; y: number } {
  if (waypoints.length === 0) return { x: 0, y: 0 };
  if (frame <= waypoints[0].frame) {
    return { x: waypoints[0].x, y: waypoints[0].y };
  }

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    if (frame >= from.frame && frame <= to.frame) {
      const progress = interpolate(frame, [from.frame, to.frame], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.ease),
      });
      return {
        x: interpolate(progress, [0, 1], [from.x, to.x]),
        y: interpolate(progress, [0, 1], [from.y, to.y]),
      };
    }
  }

  const last = waypoints[waypoints.length - 1];
  return { x: last.x, y: last.y };
}
