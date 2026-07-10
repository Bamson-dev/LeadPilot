import { C, FONT } from "./theme";

export function AnnouncementBar() {
  return (
    <div
      className="marketing-announcement-bar"
      style={{
        width: "100%",
        padding: "12px 16px",
        textAlign: "center",
        fontFamily: FONT,
        fontSize: 13,
        fontWeight: 700,
        color: C.purpleMuted,
        backgroundColor: "#1a1030",
      }}
    >
      Only 6 of 20 lifetime slots left at $25. After that it becomes $100 a year.
    </div>
  );
}
