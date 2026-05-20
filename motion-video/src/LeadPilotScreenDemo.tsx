import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrandBackground } from "./components/BrandBackground";
import { DEMO_SCENARIOS } from "./data/demo-leads";
import {
  acceleratingCount,
  DEMO_SCENARIOS as CONFIGS,
  DEMO_TIMING,
  scenarioBusinessFrames,
  scenarioDiscoverFrames,
  totalScreenDemoFrames,
} from "./lib/demo-timing";
import { colors, font } from "./theme";

export { totalScreenDemoFrames };

const glass: React.CSSProperties = {
  background: "rgba(17, 17, 19, 0.75)",
  backdropFilter: "blur(16px)",
  border: `1px solid ${colors.border}`,
  borderRadius: 20,
};

function getCycleState(frame: number) {
  let cursor = 0;
  for (let i = 0; i < CONFIGS.length; i++) {
    const cfg = CONFIGS[i]!;
    const bizFrames = scenarioBusinessFrames(cfg.business);
    const discoverFrames = scenarioDiscoverFrames(
      cfg.location,
      cfg.targetCount
    );
    const segment =
      bizFrames + discoverFrames + DEMO_TIMING.pauseBetweenSearchesFrames;

    if (frame < cursor + segment) {
      const local = frame - cursor;
      const discoverStart = bizFrames;
      const rowsStart =
        discoverStart + DEMO_TIMING.scanLeadStartFrames;
      return {
        index: i,
        local,
        bizFrames,
        discoverStart,
        discoverFrames,
        rowsStart,
        isBetween: local >= discoverStart + discoverFrames,
      };
    }
    cursor += segment;
  }
  const last = CONFIGS.length - 1;
  return {
    index: last,
    local: 0,
    bizFrames: 0,
    discoverStart: 0,
    discoverFrames: 0,
    rowsStart: 0,
    isBetween: true,
  };
}

export const LeadPilotScreenDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const {
    index,
    local,
    bizFrames,
    discoverStart,
    discoverFrames,
    rowsStart,
    isBetween,
  } = getCycleState(frame);

  const scenario = DEMO_SCENARIOS[index]!;
  const cfg = CONFIGS[index]!;

  const typedBusiness = useMemo(() => {
    if (local >= bizFrames) return cfg.business;
    return cfg.business.slice(0, Math.floor(local / DEMO_TIMING.charFrames));
  }, [local, bizFrames, cfg.business]);

  const typedLocation = useMemo(() => {
    if (local < discoverStart) return "";
    const locLocal = local - discoverStart;
    return cfg.location.slice(
      0,
      Math.min(
        cfg.location.length,
        Math.floor(locLocal / DEMO_TIMING.charFrames)
      )
    );
  }, [local, discoverStart, cfg.location]);

  const isDiscovering =
    local >= discoverStart && local < discoverStart + discoverFrames;
  const rowsLocal = local - rowsStart;
  const rowCount =
    isDiscovering && local >= rowsStart
      ? Math.min(
          scenario.leads.length,
          Math.floor(Math.max(0, rowsLocal) / DEMO_TIMING.rowIntervalFrames)
        )
      : isBetween
        ? 0
        : scenario.leads.length;

  const streamGlobalStart = frame - rowsLocal;
  const counter =
    isDiscovering && local >= rowsStart
      ? acceleratingCount(
          frame,
          streamGlobalStart,
          cfg.targetCount,
          DEMO_TIMING.counterRampFrames
        )
      : rowCount > 0
        ? cfg.targetCount
        : 0;

  const visibleLeads = scenario.leads.slice(
    Math.max(0, rowCount - 11),
    rowCount
  );

  const locDone =
    typedLocation.length >= cfg.location.length && local >= discoverStart;

  const phase = !isDiscovering
    ? ""
    : rowCount === 0
      ? "Scanning businesses in your area…"
      : !locDone
        ? "Matches appearing as we scan…"
        : scenario.phaseFound;

  const lifetimeStart =
    totalScreenDemoFrames() - DEMO_TIMING.lifetimeOfferFrames;
  const showLifetime = frame >= lifetimeStart;
  const { fps } = useVideoConfig();
  const lifetimeEnter = spring({
    frame: frame - lifetimeStart,
    fps,
    config: { damping: 14 },
  });

  if (showLifetime) {
    return (
      <AbsoluteFill
        style={{
          fontFamily: font,
          backgroundColor: colors.bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <BrandBackground intensity={1} />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            opacity: lifetimeEnter,
            transform: `scale(${interpolate(lifetimeEnter, [0, 1], [0.94, 1])})`,
          }}
        >
          <p style={{ fontSize: 22, color: colors.muted, margin: 0 }}>
            You&apos;re getting
          </p>
          <h2
            style={{
              margin: "20px 0 0",
              fontSize: 72,
              fontWeight: 800,
              background: `linear-gradient(90deg, ${colors.violetLight}, ${colors.indigo}, ${colors.fuchsia})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            LIFETIME ACCESS
          </h2>
          <p
            style={{
              marginTop: 24,
              fontSize: 20,
              color: colors.muted,
              maxWidth: 520,
              lineHeight: 1.5,
            }}
          >
            Unlimited business discovery, live lead streaming, and exports — one
            payment, forever.
          </p>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ fontFamily: font, backgroundColor: colors.bg }}>
      <BrandBackground intensity={0.9} />
      <div style={{ padding: "56px 72px", position: "relative", zIndex: 1 }}>
        <div style={{ ...glass, padding: 32, marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 28, color: colors.white, fontWeight: 700 }}>
            Discover Prospects
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 15, color: colors.muted }}>
            Build client lists by niche and location — contacts stream in realtime.
          </p>
          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: 16,
              alignItems: "end",
            }}
          >
            <div>
              <label style={{ fontSize: 11, color: colors.mutedDark, textTransform: "uppercase" }}>
                Business type
              </label>
              <div
                style={{
                  marginTop: 8,
                  height: 48,
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  background: colors.surfaceAlt,
                  padding: "0 14px",
                  display: "flex",
                  alignItems: "center",
                  color: colors.white,
                  fontSize: 18,
                }}
              >
                {typedBusiness}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: colors.mutedDark, textTransform: "uppercase" }}>
                Location
              </label>
              <div
                style={{
                  marginTop: 8,
                  height: 48,
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  background: colors.surfaceAlt,
                  padding: "0 14px",
                  display: "flex",
                  alignItems: "center",
                  color: colors.white,
                  fontSize: 18,
                }}
              >
                {typedLocation}
              </div>
            </div>
            <div
              style={{
                height: 48,
                padding: "0 24px",
                borderRadius: 12,
                background: `linear-gradient(135deg, ${colors.violet}, ${colors.indigo})`,
                display: "flex",
                alignItems: "center",
                color: colors.white,
                fontWeight: 600,
              }}
            >
              Find Leads →
            </div>
          </div>
          {phase ? (
            <p style={{ marginTop: 16, fontSize: 14, color: colors.muted }}>{phase}</p>
          ) : null}
        </div>

        {(isDiscovering || rowCount > 0) && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 24, color: colors.white }}>
                Live discovery feed
              </h2>
              <p style={{ margin: "6px 0 0", color: colors.muted, fontSize: 15 }}>
                {scenario.search.business} · {scenario.search.location}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: colors.emerald,
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: colors.emerald,
                }}
              />
              <span style={{ color: colors.white }}>{counter}</span>
              <span style={{ color: colors.muted, fontWeight: 500 }}>
                businesses found
              </span>
            </div>
          </div>
        )}

        <div style={{ ...glass, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                {["Business", "Address", "Phone", "Email", "Rating"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      fontSize: 10,
                      textTransform: "uppercase",
                      color: colors.mutedDark,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map((lead, i) => {
                const rowAge =
                  rowsLocal -
                  (rowCount - visibleLeads.length + i) *
                    DEMO_TIMING.rowIntervalFrames;
                const enter = interpolate(rowAge, [0, 10], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const y = interpolate(enter, [0, 1], [14, 0]);
                return (
                  <tr
                    key={`${lead.name}-${i}`}
                    style={{
                      borderBottom: `1px solid ${colors.border}`,
                      opacity: enter,
                      transform: `translateY(${y}px)`,
                    }}
                  >
                    <td style={{ padding: "10px 16px", color: colors.white, fontWeight: 600 }}>
                      {lead.name}
                    </td>
                    <td style={{ padding: "10px 16px", color: colors.muted }}>{lead.address}</td>
                    <td style={{ padding: "10px 16px", color: colors.muted }}>{lead.phone}</td>
                    <td style={{ padding: "10px 16px", color: colors.violetLight }}>{lead.email}</td>
                    <td style={{ padding: "10px 16px", color: colors.amber }}>★ {lead.rating}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rowCount > 0 ? (
            <div
              style={{
                padding: "10px 16px",
                fontSize: 12,
                color: colors.mutedDark,
                borderTop: `1px solid ${colors.border}`,
              }}
            >
              Showing {rowCount} of {cfg.targetCount} prospects
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
