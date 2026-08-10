import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "../constants/theme";
import { fontFamily } from "./LeadThurLogo";

interface TypedTextProps {
  text: string;
  startFrame: number;
  charDelay?: number;
  showCursor?: boolean;
  cursorEndFrame?: number;
  style?: React.CSSProperties;
}

export const TypedText: React.FC<TypedTextProps> = ({
  text,
  startFrame,
  charDelay = 3,
  showCursor = true,
  cursorEndFrame,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (localFrame < 0) return null;

  const display = text.slice(
    0,
    Math.min(text.length, Math.floor(localFrame / charDelay) + 1)
  );

  const cursorVisible =
    showCursor &&
    localFrame >= 0 &&
    (cursorEndFrame === undefined
      ? display.length < text.length
      : frame < cursorEndFrame) &&
    Math.floor(frame / 15) % 2 === 0;

  return (
    <span style={{ fontFamily, color: COLORS.white, ...style }}>
      {display}
      {cursorVisible && (
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: "1em",
            background: COLORS.purpleLight,
            marginLeft: 1,
            verticalAlign: "text-bottom",
          }}
        />
      )}
    </span>
  );
};
