import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { DEMO_LEADS } from "../constants/data";
import { COLORS } from "../constants/theme";
import { CounterAnimation } from "./CounterAnimation";
import { PulsingDot } from "./PulsingDot";

interface DashboardMockupProps {
  startFrame?: number;
  rowDelay?: number;
  businessCount?: number;
  highlightColumn?: "email" | "phone" | null;
  showExportPulse?: boolean;
}

const SPRING = { mass: 0.5, damping: 15, stiffness: 100 };

export const DashboardMockup: React.FC<DashboardMockupProps> = ({
  startFrame = 0,
  rowDelay = 40,
  businessCount = 147,
  highlightColumn = null,
  showExportPulse = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  const exportPulse = showExportPulse
    ? interpolate((localFrame % 30) / 30, [0, 0.5, 1], [1, 1.08, 1])
    : 1;

  return (
    <div
      style={{
        width: "92%",
        margin: "0 auto",
        background: COLORS.surface,
        borderRadius: 16,
        border: `1px solid ${COLORS.accent}55`,
        overflow: "hidden",
        boxShadow: `0 0 40px ${COLORS.accentGlow}`,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.surfaceAlt,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PulsingDot size={10} />
          <span
            style={{
              color: COLORS.white,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <CounterAnimation
              value={String(businessCount)}
              duration={20}
              style={{ fontSize: 14, fontWeight: 700 }}
            />{" "}
            businesses found
          </span>
        </div>
        <div
          style={{
            background: COLORS.accent,
            color: COLORS.white,
            padding: "8px 18px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
            transform: `scale(${exportPulse})`,
            boxShadow: showExportPulse ? `0 0 20px ${COLORS.accentGlow}` : "none",
          }}
        >
          Export CSV
        </div>
      </div>

      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.4fr 1.6fr 1fr 0.7fr",
          padding: "12px 20px",
          borderBottom: `1px solid ${COLORS.border}`,
          fontSize: 11,
          fontWeight: 700,
          color: COLORS.muted,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <span>Business Name</span>
        <span style={highlightColumn === "phone" ? highlightStyle : undefined}>Phone</span>
        <span style={highlightColumn === "email" ? highlightStyle : undefined}>Email</span>
        <span>City</span>
        <span>Rating</span>
      </div>

      {/* Rows */}
      {DEMO_LEADS.map((lead, i) => {
        const rowFrame = localFrame - i * rowDelay;
        if (rowFrame < 0) return null;

        const progress = spring({
          frame: rowFrame,
          fps,
          config: SPRING,
        });

        const translateX = interpolate(progress, [0, 1], [80, 0]);

        return (
          <div
            key={lead.name}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.4fr 1.6fr 1fr 0.7fr",
              padding: "14px 20px",
              borderBottom: `1px solid ${COLORS.border}`,
              opacity: progress,
              transform: `translateX(${translateX}px)`,
              fontSize: 13,
              fontFamily: "Inter, sans-serif",
              alignItems: "center",
            }}
          >
            <span style={{ color: COLORS.white, fontWeight: 600 }}>{lead.name}</span>
            <span
              style={{
                color: COLORS.white,
                ...(highlightColumn === "phone" ? cellHighlight : {}),
              }}
            >
              {lead.phone}
            </span>
            <span
              style={{
                color: COLORS.accentLight,
                ...(highlightColumn === "email" ? cellHighlight : {}),
              }}
            >
              {lead.email}
            </span>
            <span style={{ color: COLORS.muted }}>{lead.city}</span>
            <span style={{ color: COLORS.gold, fontWeight: 700 }}>★ {lead.rating}</span>
          </div>
        );
      })}
    </div>
  );
};

const highlightStyle: React.CSSProperties = {
  color: COLORS.accentLight,
  textShadow: `0 0 12px ${COLORS.accentGlow}`,
};

const cellHighlight: React.CSSProperties = {
  background: `${COLORS.accent}22`,
  borderRadius: 4,
  padding: "2px 4px",
};
