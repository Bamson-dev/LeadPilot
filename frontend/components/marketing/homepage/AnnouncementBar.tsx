import { C, FONT } from "./theme";

export function AnnouncementBar() {
  return (
    <div
      className="marketing-announcement-bar"
      style={{
        width: "100%",
        padding: "10px 16px",
        textAlign: "center",
        fontFamily: FONT,
        fontSize: 13,
        fontWeight: 700,
        color: C.purpleMuted,
        backgroundColor: "#1a1030",
      }}
    >
      🔥 Lifetime deal closing soon. Price increases permanently once the remaining slots are
      gone.
    </div>
  );
}
