import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants/theme";

interface CounterAnimationProps {
  value: string;
  duration?: number;
  delay?: number;
  style?: React.CSSProperties;
}

function parseValue(value: string): {
  prefix: string;
  suffix: string;
  numeric: number;
  hasNumeric: boolean;
} {
  const prefixMatch = value.match(/^([₦$€£]+)/);
  const prefix = prefixMatch ? prefixMatch[1] : "";
  const withoutPrefix = prefix ? value.slice(prefix.length) : value;
  const suffixMatch = withoutPrefix.match(/(\+|K|s)$/);
  const suffix = suffixMatch ? suffixMatch[1] : "";
  const numericPart = withoutPrefix.replace(/[^0-9.]/g, "");
  const numeric = numericPart ? parseFloat(numericPart) : 0;

  return {
    prefix,
    suffix,
    numeric,
    hasNumeric: numericPart.length > 0,
  };
}

function formatNumber(n: number, original: string): string {
  if (original.includes(",")) {
    return Math.round(n).toLocaleString("en-US");
  }
  if (original.includes(".")) {
    return n.toFixed(1);
  }
  return String(Math.round(n));
}

export const CounterAnimation: React.FC<CounterAnimationProps> = ({
  value,
  duration = 30,
  delay = 0,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { prefix, suffix, numeric, hasNumeric } = parseValue(value);

  if (!hasNumeric) {
    return (
      <span
        style={{
          color: COLORS.white,
          fontWeight: 800,
          fontFamily: "Inter, sans-serif",
          ...style,
        }}
      >
        {value}
      </span>
    );
  }

  const progress = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const current = numeric * progress;
  const display = formatNumber(current, value);

  return (
    <span
      style={{
        color: COLORS.white,
        fontWeight: 800,
        fontFamily: "Inter, sans-serif",
        ...style,
      }}
    >
      {prefix}
      {display}
      {suffix}
    </span>
  );
};
