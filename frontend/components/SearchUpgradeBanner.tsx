"use client";

interface SearchUpgradeBannerProps {
  searchesRemaining: number;
  creditsRemaining: number;
  onUpgradeClick: () => void;
}

export default function SearchUpgradeBanner({
  searchesRemaining,
  creditsRemaining,
  onUpgradeClick,
}: SearchUpgradeBannerProps) {
  const isExhausted = searchesRemaining <= 0 && creditsRemaining < 3;
  const isLow = searchesRemaining > 0 && searchesRemaining <= 10;
  const hasCreditsOnly = searchesRemaining <= 0 && creditsRemaining >= 3;

  if (!isExhausted && !isLow && !hasCreditsOnly) return null;

  if (isExhausted) {
    return (
      <div
        style={{
          width: "100%",
          background:
            "linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(167,139,250,0.04) 100%)",
          border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: 12,
          padding: "14px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: "rgba(124,58,237,0.12)",
              border: "1px solid rgba(124,58,237,0.2)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            ⚡
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#F2F1FF",
                marginBottom: 2,
              }}
            >
              You have used all your free searches for this month
            </div>
            <div style={{ fontSize: 12, color: "#8888A8", lineHeight: 1.5 }}>
              Top up now to keep finding clients today.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onUpgradeClick}
          style={{
            background: "#7C3AED",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "9px 20px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            whiteSpace: "nowrap",
            boxShadow: "0 0 20px rgba(124,58,237,0.3)",
            flexShrink: 0,
          }}
        >
          Top Up Searches
        </button>
      </div>
    );
  }

  if (hasCreditsOnly) {
    return (
      <div
        style={{
          width: "100%",
          background: "rgba(167,139,250,0.04)",
          border: "1px solid rgba(167,139,250,0.15)",
          borderRadius: 12,
          padding: "12px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14 }}>💳</span>
          <div style={{ fontSize: 13, color: "#A78BFA", lineHeight: 1.5 }}>
            Free searches used up. You are now using your{" "}
            <strong style={{ color: "#F2F1FF" }}>{creditsRemaining} credits</strong> (
            {Math.floor(creditsRemaining / 3)} searches remaining). Each search uses 3
            credits.
          </div>
        </div>
        <button
          type="button"
          onClick={onUpgradeClick}
          style={{
            background: "transparent",
            color: "#A78BFA",
            border: "1px solid rgba(167,139,250,0.3)",
            borderRadius: 8,
            padding: "7px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Get More Credits
        </button>
      </div>
    );
  }

  if (isLow) {
    return (
      <div
        style={{
          width: "100%",
          background: "rgba(245,158,11,0.04)",
          border: "1px solid rgba(245,158,11,0.15)",
          borderRadius: 12,
          padding: "12px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <div style={{ fontSize: 13, color: "#F59E0B", lineHeight: 1.5 }}>
            You have{" "}
            <strong style={{ color: "#F2F1FF" }}>
              {searchesRemaining} free {searchesRemaining === 1 ? "search" : "searches"}
            </strong>{" "}
            remaining this month. Top up to avoid interruption.
          </div>
        </div>
        <button
          type="button"
          onClick={onUpgradeClick}
          style={{
            background: "transparent",
            color: "#F59E0B",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 8,
            padding: "7px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Top Up Now
        </button>
      </div>
    );
  }

  return null;
}
