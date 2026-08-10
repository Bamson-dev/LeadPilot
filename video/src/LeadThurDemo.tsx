import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const COLORS = {
  bg: "#050508",
  surface: "#0F0F14",
  surfaceAlt: "#111118",
  border: "rgba(255,255,255,0.07)",
  purple: "#7C3AED",
  lavender: "#A78BFA",
  green: "#10B981",
  white: "#F2F1FF",
  muted: "#8888A8",
  gold: "#F59E0B",
  red: "#EF4444",
};

const DEMO_RESULTS = [
  {
    name: "Al Tamimi & Company",
    phone: "+971 4 364 1641",
    email: "info@tamimi.com",
    website: "www.tamimi.com",
    rating: 4.9,
  },
  {
    name: "Hadef & Partners LLC",
    phone: "+971 4 429 2999",
    email: "contact@hadefpartners.com",
    website: "www.hadefpartners.com",
    rating: 4.8,
  },
  {
    name: "Gulf Legal Associates",
    phone: "+971 4 227 8801",
    email: "legal@gulflegal.ae",
    website: "www.gulflegal.ae",
    rating: 4.7,
  },
  {
    name: "Dubai Law Group",
    phone: "+971 4 355 9900",
    email: "hello@dubailawgroup.com",
    website: "www.dubailawgroup.com",
    rating: 4.6,
  },
  {
    name: "Emirates Legal Counsel",
    phone: "+971 4 447 1200",
    email: "counsel@emirateslegal.ae",
    website: "www.emirateslegal.ae",
    rating: 4.8,
  },
  {
    name: "Arabian Justice Partners",
    phone: "+971 4 512 3344",
    email: "info@arabianjustice.com",
    website: "www.arabianjustice.com",
    rating: 4.5,
  },
  {
    name: "Al Reem Law Firm",
    phone: "+971 4 339 8712",
    email: "contact@alreemlaw.ae",
    website: "www.alreemlaw.ae",
    rating: 4.7,
  },
  {
    name: "Sharjah Legal Hub",
    phone: "+971 6 574 2200",
    email: "hello@sharjahlegal.com",
    website: "www.sharjahlegal.com",
    rating: 4.4,
  },
  {
    name: "Marina Legal Services",
    phone: "+971 4 448 9900",
    email: "info@marinalegal.ae",
    website: "www.marinalegal.ae",
    rating: 4.6,
  },
  {
    name: "DIFC Law Associates",
    phone: "+971 4 401 9000",
    email: "difc@lawassociates.ae",
    website: "www.lawassociates.ae",
    rating: 4.9,
  },
  {
    name: "Noor & Partners Legal",
    phone: "+971 4 358 7700",
    email: "noor@noorpartners.com",
    website: "www.noorpartners.com",
    rating: 4.5,
  },
  {
    name: "Business Bay Lawyers",
    phone: "+971 4 423 1100",
    email: "info@bblawyers.ae",
    website: "www.bblawyers.ae",
    rating: 4.3,
  },
  {
    name: "Pearl Legal Consultancy",
    phone: "+971 4 516 8800",
    email: "pearl@pearllegal.ae",
    website: "www.pearllegal.ae",
    rating: 4.7,
  },
  {
    name: "Jumeirah Law Office",
    phone: "+971 4 394 5500",
    email: "office@jumeirahlaw.com",
    website: "www.jumeirahlaw.com",
    rating: 4.6,
  },
  {
    name: "Gold Coast Legal Group",
    phone: "+971 4 288 3300",
    email: "legal@goldcoastdubai.ae",
    website: "www.goldcoastdubai.ae",
    rating: 4.8,
  },
];

function fadeIn(frame: number, start: number, duration: number): number {
  return Math.min(1, Math.max(0, (frame - start) / duration));
}

function HomepageScene({ frame }: { frame: number }) {
  const navOpacity = fadeIn(frame, 0, 20);
  const heroOpacity = fadeIn(frame, 20, 40);
  const subOpacity = fadeIn(frame, 60, 40);
  const statsOpacity = fadeIn(frame, 100, 40);
  const ctaOpacity = fadeIn(frame, 140, 40);

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: "Inter, sans-serif" }}>
      <div
        style={{
          opacity: navOpacity,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "20px 60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${COLORS.border}`,
          background: "rgba(5,5,8,0.95)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              background: COLORS.purple,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: "white",
            }}
          >
            LT
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, color: COLORS.white }}>
            Lead<span style={{ color: COLORS.lavender }}>Thur</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
          {["How it works", "Features", "Pricing", "Affiliate"].map((item) => (
            <span key={item} style={{ color: COLORS.muted, fontSize: 15 }}>
              {item}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ color: COLORS.lavender, fontSize: 15, fontWeight: 600 }}>
            Try Free
          </span>
          <div
            style={{
              background: COLORS.purple,
              color: "white",
              padding: "10px 22px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Login
          </div>
        </div>
      </div>

      <div
        style={{
          opacity: heroOpacity,
          position: "absolute",
          top: 160,
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 200px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(167,139,250,0.08)",
            border: "1px solid rgba(167,139,250,0.2)",
            padding: "8px 18px",
            borderRadius: 100,
            fontSize: 13,
            color: COLORS.lavender,
            fontWeight: 600,
            marginBottom: 32,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              background: COLORS.green,
              borderRadius: "50%",
              display: "inline-block",
            }}
          />
          Live across 195 countries
        </div>
        <div
          style={{
            fontSize: 82,
            fontWeight: 900,
            letterSpacing: -4,
            lineHeight: 1.02,
            color: COLORS.white,
            marginBottom: 28,
          }}
        >
          Stop searching for clients.
          <br />
          <span style={{ color: COLORS.lavender }}>Find them in 60 seconds.</span>
        </div>
      </div>

      <div
        style={{
          opacity: subOpacity,
          position: "absolute",
          top: 560,
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 400px",
        }}
      >
        <div style={{ fontSize: 18, color: COLORS.muted, lineHeight: 1.7 }}>
          Type any business type and any city in the world.{" "}
          <strong style={{ color: COLORS.white }}>LeadThur returns real businesses</strong>{" "}
          with phone numbers, emails, and addresses. Ready to reach out. Same day.
        </div>
      </div>

      <div
        style={{
          opacity: ctaOpacity,
          position: "absolute",
          top: 680,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            background: COLORS.purple,
            color: "white",
            padding: "18px 40px",
            borderRadius: 14,
            fontSize: 17,
            fontWeight: 800,
            boxShadow: "0 0 60px rgba(124,58,237,0.5)",
          }}
        >
          Get Lifetime Access — $25
        </div>
        <div
          style={{
            background: "rgba(167,139,250,0.08)",
            border: "1px solid rgba(167,139,250,0.3)",
            color: COLORS.lavender,
            padding: "18px 40px",
            borderRadius: 14,
            fontSize: 17,
            fontWeight: 700,
          }}
        >
          Try it free first →
        </div>
      </div>

      <div
        style={{
          opacity: statsOpacity,
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 80,
          borderTop: `1px solid ${COLORS.border}`,
          paddingTop: 40,
          margin: "0 200px",
        }}
      >
        {[
          { num: "1,000+", label: "Leads per search" },
          { num: "60s", label: "To first result" },
          { num: "195+", label: "Countries covered" },
          { num: "$0", label: "Monthly fee" },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 36,
                fontWeight: 900,
                color: COLORS.lavender,
                letterSpacing: -1,
              }}
            >
              {stat.num}
            </div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function NavigateScene({ frame }: { frame: number }) {
  const localFrame = frame - 480;

  const cursorX = interpolate(localFrame, [0, 60], [1200, 1580], {
    extrapolateRight: "clamp",
  });
  const cursorY = interpolate(localFrame, [0, 60], [540, 40], {
    extrapolateRight: "clamp",
  });
  const clickScale = interpolate(localFrame, [60, 65, 75], [1, 0.8, 1], {
    extrapolateRight: "clamp",
  });
  const screenFadeOut = interpolate(localFrame, [140, 180], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: "Inter, sans-serif" }}>
      <div style={{ opacity: 1 - screenFadeOut * 0.7 }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "20px 60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${COLORS.border}`,
            background: "rgba(5,5,8,0.95)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                background: COLORS.purple,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
                color: "white",
              }}
            >
              LT
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: COLORS.white }}>
              Lead<span style={{ color: COLORS.lavender }}>Thur</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ color: COLORS.lavender, fontSize: 15, fontWeight: 600 }}>
              Try Free
            </span>
            <div
              style={{
                background:
                  localFrame > 58 && localFrame < 80 ? "#9461FA" : COLORS.purple,
                color: "white",
                padding: "10px 22px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                transform: `scale(${clickScale})`,
                boxShadow:
                  localFrame > 58 && localFrame < 80
                    ? "0 0 30px rgba(124,58,237,0.8)"
                    : "none",
              }}
            >
              Login
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: cursorX,
          top: cursorY,
          width: 24,
          height: 24,
          pointerEvents: "none",
          zIndex: 1000,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="white"
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.8))" }}
        >
          <path d="M4 0 L4 20 L8 16 L12 24 L14 23 L10 15 L16 15 Z" />
        </svg>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.bg,
          opacity: screenFadeOut,
        }}
      />
    </AbsoluteFill>
  );
}

function DashboardScene({ frame }: { frame: number }) {
  const localFrame = frame - 660;

  const businessTypeText = "Law Firms";
  const cityText = "Dubai, UAE";
  const businessTypeChars = Math.floor(
    interpolate(localFrame, [30, 120], [0, businessTypeText.length], {
      extrapolateRight: "clamp",
    })
  );
  const cityChars = Math.floor(
    interpolate(localFrame, [150, 230], [0, cityText.length], {
      extrapolateRight: "clamp",
    })
  );

  const searchClick = localFrame > 270 && localFrame < 310;
  const searchButtonScale = interpolate(localFrame, [270, 275, 295], [1, 0.92, 1], {
    extrapolateRight: "clamp",
  });

  const searchStartFrame = 310;
  const resultsVisible = localFrame > searchStartFrame;
  const resultCount = Math.floor(
    interpolate(
      localFrame,
      [searchStartFrame, searchStartFrame + 400],
      [0, 847],
      { extrapolateRight: "clamp" }
    )
  );

  const rowsToShow = resultsVisible
    ? Math.min(15, Math.floor((localFrame - searchStartFrame) / 25))
    : 0;

  const cursorX = interpolate(
    localFrame,
    [0, 20, 100, 140, 260, 290],
    [960, 400, 400, 900, 900, 1100],
    { extrapolateRight: "clamp" }
  );
  const cursorY = interpolate(
    localFrame,
    [0, 20, 100, 140, 260, 290],
    [540, 300, 300, 300, 300, 300],
    { extrapolateRight: "clamp" }
  );

  const dashOpacity = fadeIn(localFrame, 0, 30);

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily: "Inter, sans-serif",
        opacity: dashOpacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "18px 60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${COLORS.border}`,
          background: "rgba(5,5,8,0.95)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: COLORS.purple,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "white",
            }}
          >
            LT
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.white }}>
            Lead<span style={{ color: COLORS.lavender }}>Thur</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: COLORS.purple,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "white",
            }}
          >
            DB
          </div>
          <span style={{ fontSize: 14, color: COLORS.white }}>demo@leadthur.com</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 100,
          left: 60,
          right: 60,
        }}
      >
        <div
          style={{
            background: COLORS.surfaceAlt,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 32,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: COLORS.white,
              marginBottom: 8,
            }}
          >
            Find Business Contacts
          </div>
          <div style={{ fontSize: 14, color: COLORS.muted, marginBottom: 24 }}>
            Type any business type and city. Get phone numbers, emails and addresses
            instantly.
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  color: COLORS.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Business Type
              </label>
              <div
                style={{
                  background: "#0A0A10",
                  border: `1px solid ${
                    localFrame > 20 && localFrame < 130
                      ? COLORS.purple
                      : "rgba(255,255,255,0.1)"
                  }`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  fontSize: 16,
                  color: COLORS.white,
                  boxShadow:
                    localFrame > 20 && localFrame < 130
                      ? "0 0 0 3px rgba(124,58,237,0.15)"
                      : "none",
                  minHeight: 52,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {businessTypeText.substring(0, businessTypeChars)}
                {localFrame > 20 && localFrame < 130 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 18,
                      background: COLORS.lavender,
                      marginLeft: 1,
                      opacity: Math.floor(localFrame / 15) % 2 === 0 ? 1 : 0,
                    }}
                  />
                )}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  color: COLORS.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                City / Country
              </label>
              <div
                style={{
                  background: "#0A0A10",
                  border: `1px solid ${
                    localFrame > 140 && localFrame < 240
                      ? COLORS.purple
                      : "rgba(255,255,255,0.1)"
                  }`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  fontSize: 16,
                  color: COLORS.white,
                  boxShadow:
                    localFrame > 140 && localFrame < 240
                      ? "0 0 0 3px rgba(124,58,237,0.15)"
                      : "none",
                  minHeight: 52,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {cityText.substring(0, cityChars)}
                {localFrame > 140 && localFrame < 240 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 18,
                      background: COLORS.lavender,
                      marginLeft: 1,
                      opacity: Math.floor(localFrame / 15) % 2 === 0 ? 1 : 0,
                    }}
                  />
                )}
              </div>
            </div>

            <div
              style={{
                background: searchClick ? "#9461FA" : COLORS.purple,
                color: "white",
                padding: "14px 36px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transform: `scale(${searchButtonScale})`,
                boxShadow: searchClick
                  ? "0 0 40px rgba(124,58,237,0.7)"
                  : "0 0 30px rgba(124,58,237,0.4)",
              }}
            >
              {localFrame > 310 ? "Searching..." : "Search"}
            </div>
          </div>
        </div>

        {resultsVisible && (
          <div
            style={{
              background: COLORS.surface,
              border: "1px solid rgba(124,58,237,0.2)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 24px",
                borderBottom: `1px solid ${COLORS.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: COLORS.green,
                    boxShadow: "0 0 8px rgba(16,185,129,0.6)",
                  }}
                />
                <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.white }}>
                  {resultCount.toLocaleString()} businesses found
                </span>
                {localFrame < searchStartFrame + 420 && (
                  <span style={{ fontSize: 12, color: COLORS.muted }}>
                    and counting...
                  </span>
                )}
              </div>
              {localFrame > searchStartFrame + 400 && (
                <div
                  style={{
                    background: COLORS.green,
                    color: "white",
                    padding: "8px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Export CSV
                </div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "40px 280px 180px 260px 200px 80px",
                padding: "10px 24px",
                background: "#0A0A10",
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              {["#", "BUSINESS NAME", "PHONE", "EMAIL", "WEBSITE", "RATING"].map(
                (h) => (
                  <div
                    key={h}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: COLORS.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}
                  >
                    {h}
                  </div>
                )
              )}
            </div>

            {DEMO_RESULTS.slice(0, rowsToShow).map((result, index) => {
              const rowAppearFrame = searchStartFrame + index * 25;
              const rowOpacity = fadeIn(localFrame, rowAppearFrame, 15);
              const rowSlide = interpolate(
                localFrame,
                [rowAppearFrame, rowAppearFrame + 15],
                [8, 0],
                { extrapolateRight: "clamp" }
              );

              return (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 280px 180px 260px 200px 80px",
                    padding: "12px 24px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: index % 2 === 0 ? COLORS.surface : "#0D0D12",
                    opacity: rowOpacity,
                    transform: `translateY(${rowSlide}px)`,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#555570" }}>{index + 1}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.white }}>
                    {result.name}
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.green, fontWeight: 500 }}>
                    {result.phone}
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.lavender }}>
                    {result.email}
                  </div>
                  <div style={{ fontSize: 13, color: "#7C3AED" }}>{result.website}</div>
                  <div style={{ fontSize: 13, color: COLORS.gold, fontWeight: 700 }}>
                    ★ {result.rating}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {localFrame < 310 && (
        <div
          style={{
            position: "absolute",
            left: cursorX,
            top: cursorY,
            width: 22,
            height: 22,
            pointerEvents: "none",
            zIndex: 1000,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="white"
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.8))" }}
          >
            <path d="M4 0 L4 20 L8 16 L12 24 L14 23 L10 15 L16 15 Z" />
          </svg>
        </div>
      )}
    </AbsoluteFill>
  );
}

function ResultsScene({ frame }: { frame: number }) {
  const localFrame = frame - 1380;

  const scrollY = interpolate(localFrame, [0, 400], [0, 320], {
    extrapolateRight: "clamp",
  });
  const exportHighlight = localFrame > 420;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: "Inter, sans-serif" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: "18px 60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${COLORS.border}`,
          background: "rgba(5,5,8,0.98)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: COLORS.purple,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "white",
            }}
          >
            LT
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.white }}>
            Lead<span style={{ color: COLORS.lavender }}>Thur</span>
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 8,
            padding: "6px 14px",
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: COLORS.green,
            }}
          />
          <span style={{ fontSize: 13, color: COLORS.green, fontWeight: 600 }}>
            847 businesses found — Law Firms in Dubai, UAE
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 80,
          left: 60,
          right: 60,
          bottom: 100,
          overflow: "hidden",
          background: COLORS.surface,
          border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "50px 1fr 180px 260px 200px 100px",
            padding: "12px 28px",
            background: "#0A0A10",
            borderBottom: `1px solid ${COLORS.border}`,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          {["#", "BUSINESS NAME", "PHONE", "EMAIL", "WEBSITE", "RATING"].map((h) => (
            <div
              key={h}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: COLORS.muted,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              {h}
            </div>
          ))}
        </div>

        <div style={{ transform: `translateY(-${scrollY}px)` }}>
          {[...DEMO_RESULTS, ...DEMO_RESULTS, ...DEMO_RESULTS].map((result, index) => (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns: "50px 1fr 180px 260px 200px 100px",
                padding: "14px 28px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: index % 2 === 0 ? COLORS.surface : "#0D0D12",
              }}
            >
              <div style={{ fontSize: 12, color: "#555570" }}>{index + 1}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.white }}>
                {result.name}
              </div>
              <div style={{ fontSize: 13, color: COLORS.green, fontWeight: 500 }}>
                {result.phone}
              </div>
              <div style={{ fontSize: 13, color: COLORS.lavender }}>{result.email}</div>
              <div style={{ fontSize: 12, color: "#7C3AED" }}>{result.website}</div>
              <div style={{ fontSize: 13, color: COLORS.gold, fontWeight: 700 }}>
                ★ {result.rating}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 30,
          right: 60,
          background: exportHighlight ? COLORS.green : "rgba(16,185,129,0.2)",
          border: `1px solid ${COLORS.green}`,
          color: exportHighlight ? "white" : COLORS.green,
          padding: "14px 32px",
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 700,
          boxShadow: exportHighlight ? "0 0 40px rgba(16,185,129,0.5)" : "none",
        }}
      >
        Export CSV — 847 contacts
      </div>
    </AbsoluteFill>
  );
}

function ExportScene({ frame }: { frame: number }) {
  const localFrame = frame - 1860;

  const clickFrame = 60;
  const dialogOpacity = fadeIn(localFrame, clickFrame + 10, 20);
  const downloadBarWidth = interpolate(
    localFrame,
    [clickFrame + 30, clickFrame + 120],
    [0, 100],
    { extrapolateRight: "clamp" }
  );
  const successOpacity = fadeIn(localFrame, clickFrame + 130, 20);

  const cursorX = interpolate(localFrame, [0, 50], [1700, 1700], {
    extrapolateRight: "clamp",
  });
  const cursorY = interpolate(localFrame, [0, 50], [600, 1020], {
    extrapolateRight: "clamp",
  });
  const clickScale = interpolate(localFrame, [55, 60, 70], [1, 0.85, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: "Inter, sans-serif" }}>
      <div
        style={{
          opacity: 0.3,
          filter: "blur(2px)",
          position: "absolute",
          inset: 0,
          background: COLORS.bg,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "18px 60px",
          display: "flex",
          alignItems: "center",
          borderBottom: `1px solid ${COLORS.border}`,
          background: "rgba(5,5,8,0.98)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: COLORS.purple,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "white",
            }}
          >
            LT
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.white }}>
            Lead<span style={{ color: COLORS.lavender }}>Thur</span>
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 30,
          right: 60,
          background:
            localFrame > 55 && localFrame < 75 ? "#0EA572" : COLORS.green,
          color: "white",
          padding: "14px 32px",
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 700,
          transform: `scale(${clickScale})`,
          boxShadow: "0 0 40px rgba(16,185,129,0.5)",
        }}
      >
        Export CSV — 847 contacts
      </div>

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: COLORS.surfaceAlt,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 40,
          width: 480,
          opacity: dialogOpacity,
          boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: COLORS.white,
            marginBottom: 8,
          }}
        >
          Preparing your CSV export
        </div>
        <div style={{ fontSize: 14, color: COLORS.muted, marginBottom: 24 }}>
          leadthur-law-firms-dubai-uae.csv
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: 100,
            height: 8,
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${downloadBarWidth}%`,
              height: "100%",
              background: COLORS.green,
              borderRadius: 100,
              boxShadow: "0 0 10px rgba(16,185,129,0.5)",
            }}
          />
        </div>

        <div style={{ fontSize: 13, color: COLORS.muted }}>
          {downloadBarWidth < 100
            ? `Exporting ${Math.floor(downloadBarWidth * 8.47)} of 847 contacts...`
            : "847 contacts exported successfully"}
        </div>

        {localFrame > clickFrame + 130 && (
          <div
            style={{
              marginTop: 20,
              opacity: successOpacity,
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 10,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18 }}>✓</span>
            <span style={{ fontSize: 13, color: COLORS.green, fontWeight: 600 }}>
              File saved to your downloads folder
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: cursorX,
          top: cursorY,
          width: 22,
          height: 22,
          pointerEvents: "none",
          zIndex: 1000,
          transform: `scale(${clickScale})`,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="white"
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.8))" }}
        >
          <path d="M4 0 L4 20 L8 16 L12 24 L14 23 L10 15 L16 15 Z" />
        </svg>
      </div>
    </AbsoluteFill>
  );
}

function CTAScene({ frame }: { frame: number }) {
  const localFrame = frame - 2160;

  const headlineOpacity = fadeIn(localFrame, 0, 40);
  const subOpacity = fadeIn(localFrame, 60, 40);
  const priceOpacity = fadeIn(localFrame, 120, 40);
  const btnOpacity = fadeIn(localFrame, 180, 40);
  const urlOpacity = fadeIn(localFrame, 240, 40);

  const btnPulse = Math.sin(localFrame * 0.1) * 0.02 + 1;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily: "Inter, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 800,
          height: 800,
          background:
            "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          opacity: headlineOpacity,
          marginBottom: 32,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            background: COLORS.purple,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            fontWeight: 800,
            color: "white",
          }}
        >
          LT
        </div>
        <span style={{ fontSize: 28, fontWeight: 800, color: COLORS.white }}>
          Lead<span style={{ color: COLORS.lavender }}>Thur</span>
        </span>
      </div>

      <div
        style={{
          opacity: headlineOpacity,
          fontSize: 68,
          fontWeight: 900,
          letterSpacing: -3,
          color: COLORS.white,
          lineHeight: 1.05,
          marginBottom: 20,
        }}
      >
        Stop searching.
        <br />
        <span style={{ color: COLORS.lavender }}>Start closing.</span>
      </div>

      <div
        style={{
          opacity: subOpacity,
          fontSize: 18,
          color: COLORS.muted,
          maxWidth: 560,
          lineHeight: 1.7,
          marginBottom: 32,
        }}
      >
        Find 1,000+ businesses in any city in the world.
        <br />
        Phone numbers. Emails. Addresses. In 60 seconds.
      </div>

      <div
        style={{
          opacity: priceOpacity,
          marginBottom: 40,
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            fontSize: 16,
            color: "#555570",
            textDecoration: "line-through",
          }}
        >
          Apollo: $588/yr
        </div>
        <div style={{ fontSize: 16, color: COLORS.muted }}>vs</div>
        <div style={{ fontSize: 20, color: COLORS.white, fontWeight: 800 }}>
          LeadThur: <span style={{ color: COLORS.green }}>$25 once</span>
        </div>
      </div>

      <div
        style={{
          opacity: btnOpacity,
          background: COLORS.purple,
          color: "white",
          padding: "20px 56px",
          borderRadius: 16,
          fontSize: 20,
          fontWeight: 800,
          boxShadow: "0 0 80px rgba(124,58,237,0.5)",
          transform: `scale(${btnPulse})`,
          marginBottom: 20,
        }}
      >
        Get Lifetime Access — $25
      </div>

      <div
        style={{
          opacity: urlOpacity,
          fontSize: 16,
          color: COLORS.muted,
          fontWeight: 500,
        }}
      >
        leadthur.com
      </div>
    </AbsoluteFill>
  );
}

export function LeadThurDemo() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {frame < 480 && <HomepageScene frame={frame} />}
      {frame >= 480 && frame < 660 && <NavigateScene frame={frame} />}
      {frame >= 660 && frame < 1380 && <DashboardScene frame={frame} />}
      {frame >= 1380 && frame < 1860 && <ResultsScene frame={frame} />}
      {frame >= 1860 && frame < 2160 && <ExportScene frame={frame} />}
      {frame >= 2160 && <CTAScene frame={frame} />}
    </AbsoluteFill>
  );
}
