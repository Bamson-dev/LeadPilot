import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { BusinessResult } from "../constants/data";
import { COLORS } from "../constants/theme";
import { fontFamily } from "./LeadThurLogo";

interface SpreadsheetViewProps {
  data: BusinessResult[];
  populateStartFrame: number;
  populateDuration?: number;
}

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
  data,
  populateStartFrame,
  populateDuration = 30,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - populateStartFrame;

  const rowsVisible = Math.min(
    data.length,
    Math.ceil(
      interpolate(localFrame, [0, populateDuration], [0, data.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    )
  );

  return (
    <div
      style={{
        background: "#1E1E1E",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #333",
        fontFamily,
        height: "100%",
      }}
    >
      <div
        style={{
          background: "#2D2D2D",
          padding: "8px 12px",
          fontSize: 12,
          color: "#AAA",
          borderBottom: "1px solid #444",
        }}
      >
        Spreadsheet
      </div>
      <div style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.9fr 1.1fr 0.9fr 0.5fr",
            background: "#252525",
            borderBottom: "1px solid #444",
            padding: "8px 10px",
            fontSize: 11,
            fontWeight: 700,
            color: "#DDD",
          }}
        >
          <div>Business Name</div>
          <div>Phone</div>
          <div>Email</div>
          <div>Website</div>
          <div>Rating</div>
        </div>
        {data.slice(0, rowsVisible).map((row, i) => (
          <div
            key={row.name}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 0.9fr 1.1fr 0.9fr 0.5fr",
              padding: "7px 10px",
              fontSize: 11,
              color: "#CCC",
              background: i % 2 === 0 ? "#1E1E1E" : "#252525",
              borderBottom: "1px solid #333",
            }}
          >
            <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</div>
            <div>{row.phone}</div>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{row.email}</div>
            <div>{row.website}</div>
            <div>{row.rating}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
