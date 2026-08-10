import React from "react";
import { COLORS } from "../constants/theme";
import { fontFamily } from "./LeadThurLogo";

interface DataPillProps {
  label?: string;
  value: string;
  variant?: "purple" | "card" | "green";
  icon?: React.ReactNode;
  shimmerOffset?: number;
}

export const DataPill: React.FC<DataPillProps> = ({
  label,
  value,
  variant = "card",
  icon,
  shimmerOffset = -1,
}) => {
  const bg =
    variant === "purple"
      ? COLORS.purple
      : variant === "green"
        ? "rgba(16,185,129,0.15)"
        : COLORS.card;

  const border =
    variant === "green"
      ? "rgba(16,185,129,0.4)"
      : variant === "purple"
        ? COLORS.purple
        : COLORS.border;

  const textColor =
    variant === "purple" ? COLORS.white : variant === "green" ? COLORS.green : COLORS.white;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: "12px 16px",
        fontFamily,
        flex: 1,
        minWidth: 0,
      }}
    >
      {shimmerOffset >= 0 && shimmerOffset <= 1 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${shimmerOffset * 150 - 50}%`,
            width: "40%",
            height: "100%",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
            pointerEvents: "none",
          }}
        />
      )}
      {label && (
        <div
          style={{
            fontSize: 10,
            color: variant === "purple" ? "rgba(255,255,255,0.7)" : COLORS.muted,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 4,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: textColor,
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {icon}
        {value}
      </div>
    </div>
  );
};
