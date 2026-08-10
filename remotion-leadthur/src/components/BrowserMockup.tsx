import React from "react";
import { COLORS } from "../constants/theme";
import { fontFamily } from "./LeadThurLogo";

interface BrowserMockupProps {
  children: React.ReactNode;
  url?: string;
}

export const BrowserMockup: React.FC<BrowserMockupProps> = ({
  children,
  url = "leadthur.com",
}) => {
  return (
    <div
      style={{
        width: 1400,
        height: 780,
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
        fontFamily,
      }}
    >
      <div
        style={{
          height: 48,
          background: "#0A0A12",
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <div
              key={c}
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: c,
                opacity: 0.85,
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            marginLeft: 24,
            marginRight: 24,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 14,
            color: COLORS.muted,
            textAlign: "center",
          }}
        >
          {url}
        </div>
      </div>
      <div
        style={{
          height: 732,
          background: COLORS.background,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
};
