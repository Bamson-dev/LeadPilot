import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrandBackground } from "./components/BrandBackground";
import { Logo } from "./components/Logo";
import {
  DEMO_SCENARIOS,
  HERO_EXAMPLE_CHIPS,
  FEATURES,
  type DemoScenario,
} from "./data/demo-leads";
import { colors, font } from "./theme";

const glass: React.CSSProperties = {
  background: "rgba(17, 17, 19, 0.75)",
  backdropFilter: "blur(16px)",
  border: `1px solid ${colors.border}`,
  borderRadius: 20,
};

const gradientText: React.CSSProperties = {
  background: `linear-gradient(90deg, ${colors.violetLight}, ${colors.indigo}, ${colors.fuchsia})`,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

const SEARCH_SEGMENT_FRAMES = 95;
const TABLE_SEGMENT_FRAMES = 165;

const FadeScene: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
  fade?: number;
}> = ({ children, durationInFrames, fade = 18 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, fade, durationInFrames - fade, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

function activeSegment(
  frame: number,
  segmentLength: number,
  count: number
): { index: number; localFrame: number } {
  const index = Math.min(count - 1, Math.floor(frame / segmentLength));
  return { index, localFrame: frame - index * segmentLength };
}

function typedSlice(
  text: string,
  localFrame: number,
  start: number,
  end: number
): string {
  const len = Math.floor(
    interpolate(localFrame, [start, end], [0, text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    })
  );
  return text.slice(0, len);
}

const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `scale(${interpolate(scale, [0, 1], [0.92, 1])})`,
      }}
    >
      <Logo size="lg" subtitle="Business discovery intelligence" />
    </AbsoluteFill>
  );
};

const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line1 = spring({ frame: frame - 8, fps, config: { damping: 16 } });
  const line2 = spring({ frame: frame - 22, fps, config: { damping: 16 } });
  const badge = spring({ frame: frame - 2, fps, config: { damping: 20 } });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
        fontFamily: font,
      }}
    >
      <div style={{ maxWidth: 1100, textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            opacity: badge,
            transform: `translateY(${interpolate(badge, [0, 1], [12, 0])}px)`,
            border: `1px solid ${colors.border}`,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 999,
            padding: "10px 20px",
            fontSize: 18,
            color: colors.violetLight,
            marginBottom: 36,
          }}
        >
          ✦ Built for freelancers, agencies & growth teams
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 88,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: colors.white,
            opacity: line1,
            transform: `translateY(${interpolate(line1, [0, 1], [40, 0])}px)`,
          }}
        >
          Find Businesses To Pitch
        </h1>
        <h1
          style={{
            margin: "8px 0 0",
            fontSize: 88,
            fontWeight: 800,
            lineHeight: 1.05,
            ...gradientText,
            opacity: line2,
            transform: `translateY(${interpolate(line2, [0, 1], [40, 0])}px)`,
          }}
        >
          In Seconds
        </h1>
        <p
          style={{
            marginTop: 32,
            fontSize: 26,
            color: colors.muted,
            lineHeight: 1.5,
            opacity: interpolate(frame, [35, 55], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Phone, full address, website & email — ready for outreach.
        </p>
        <div
          style={{
            marginTop: 28,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 12,
            opacity: interpolate(frame, [50, 70], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {HERO_EXAMPLE_CHIPS.map((chip, i) => (
            <span
              key={chip}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: `1px solid ${colors.borderViolet}`,
                background: "rgba(124,58,237,0.08)",
                fontSize: 15,
                color: colors.violetLight,
                opacity: interpolate(frame, [55 + i * 8, 70 + i * 8], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SearchPanel: React.FC<{
  scenario: DemoScenario;
  localFrame: number;
  showCursor: boolean;
}> = ({ scenario, localFrame, showCursor }) => {
  const typedBusiness = typedSlice(
    scenario.search.business,
    localFrame,
    8,
    38
  );
  const typedLocation = typedSlice(
    scenario.search.location,
    localFrame,
    42,
    78
  );
  const progress = interpolate(localFrame, [82, 92], [0, 72], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phase =
    localFrame < 78
      ? "Searching for restaurants in Lagos..."
      : localFrame < 88
        ? scenario.phaseFound
        : "Streaming prospects to your table…";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1200,
        ...glass,
        boxShadow: "0 0 60px rgba(124,58,237,0.12)",
        padding: 40,
      }}
    >
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <label
            style={{
              fontSize: 13,
              color: colors.mutedDark,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Business type
          </label>
          <div
            style={{
              marginTop: 8,
              height: 52,
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              background: colors.surfaceAlt,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              fontSize: 20,
              color: colors.white,
            }}
          >
            {typedBusiness}
            {showCursor ? (
              <span
                style={{
                  opacity: localFrame % 30 < 15 ? 1 : 0,
                  marginLeft: 2,
                  color: colors.violetLight,
                }}
              >
                |
              </span>
            ) : null}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label
            style={{
              fontSize: 13,
              color: colors.mutedDark,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Location
          </label>
          <div
            style={{
              marginTop: 8,
              height: 52,
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              background: colors.surfaceAlt,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              fontSize: 20,
              color: colors.white,
            }}
          >
            {typedLocation}
          </div>
        </div>
        <div
          style={{
            alignSelf: "flex-end",
            height: 52,
            padding: "0 28px",
            borderRadius: 12,
            background: `linear-gradient(135deg, ${colors.violet}, ${colors.indigo})`,
            display: "flex",
            alignItems: "center",
            fontWeight: 600,
            fontSize: 18,
            color: colors.white,
            boxShadow: "0 0 32px rgba(124,58,237,0.4)",
          }}
        >
          Find Leads →
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 16, color: colors.muted }}>{phase}</span>
        <span style={{ fontSize: 16, color: colors.emerald, fontWeight: 600 }}>
          ● Live
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${colors.violet}, ${colors.indigo})`,
          }}
        />
      </div>
    </div>
  );
};

const SearchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const { index, localFrame } = activeSegment(
    frame,
    SEARCH_SEGMENT_FRAMES,
    DEMO_SCENARIOS.length
  );
  const scenario = DEMO_SCENARIOS[index];
  const segmentFade =
    localFrame < 10
      ? interpolate(localFrame, [0, 10], [0.4, 1])
      : localFrame > SEARCH_SEGMENT_FRAMES - 12
        ? interpolate(
            localFrame,
            [SEARCH_SEGMENT_FRAMES - 12, SEARCH_SEGMENT_FRAMES],
            [1, 0.35]
          )
        : 1;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        fontFamily: font,
        padding: 100,
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          opacity: enter * segmentFade,
          transform: `translateY(${interpolate(enter, [0, 1], [30, 0])}px)`,
        }}
      >
        <span
          style={{
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: colors.mutedDark,
          }}
        >
          Example {index + 1} of {DEMO_SCENARIOS.length}
        </span>
        <SearchPanel
          scenario={scenario}
          localFrame={localFrame}
          showCursor={index === DEMO_SCENARIOS.length - 1 || localFrame < 80}
        />
      </div>
    </AbsoluteFill>
  );
};

const LeadsTable: React.FC<{
  scenario: DemoScenario;
  localFrame: number;
}> = ({ scenario, localFrame }) => {
  const visibleCount = Math.min(
    scenario.leads.length,
    Math.floor(
      interpolate(localFrame, [12, 100], [0, scenario.leads.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    )
  );
  const counter = Math.floor(
    interpolate(
      localFrame,
      [12, 130],
      [8, scenario.resultCount],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    )
  );

  const headers = ["Business", "Address", "Phone", "Email", "Rating"];

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 34,
              color: colors.white,
              fontWeight: 700,
            }}
          >
            Live discovery feed
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 18, color: colors.muted }}>
            {scenario.search.business} · {scenario.search.location}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 20,
            fontWeight: 600,
            color: colors.emerald,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: colors.emerald,
              boxShadow: `0 0 12px ${colors.emerald}`,
            }}
          />
          {counter} businesses found
        </div>
      </div>

      <div style={{ ...glass, overflow: "hidden" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 15,
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
              {headers.map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "14px 16px",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: colors.mutedDark,
                    fontWeight: 600,
                    width:
                      h === "Business"
                        ? "18%"
                        : h === "Address"
                          ? "32%"
                          : h === "Phone"
                            ? "14%"
                            : h === "Email"
                              ? "24%"
                              : "8%",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenario.leads.slice(0, visibleCount).map((lead, i) => {
              const rowEnter = spring({
                frame: localFrame - 12 - i * 7,
                fps: 30,
                config: { damping: 14, stiffness: 140 },
              });
              return (
                <tr
                  key={`${scenario.search.business}-${lead.name}`}
                  style={{
                    borderBottom: `1px solid ${colors.border}`,
                    opacity: rowEnter,
                    transform: `translateX(${interpolate(rowEnter, [0, 1], [-20, 0])}px)`,
                    background:
                      i === visibleCount - 1
                        ? "linear-gradient(90deg, rgba(124,58,237,0.08), transparent)"
                        : "transparent",
                  }}
                >
                  <td
                    style={{
                      padding: "12px 16px",
                      color: colors.white,
                      fontWeight: 600,
                      verticalAlign: "top",
                    }}
                  >
                    {lead.name}
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        fontWeight: 400,
                        color: colors.mutedDark,
                      }}
                    >
                      {lead.category}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: colors.muted,
                      lineHeight: 1.4,
                      verticalAlign: "top",
                    }}
                  >
                    {lead.address}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: colors.muted,
                      verticalAlign: "top",
                    }}
                  >
                    {lead.phone}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: colors.violetLight,
                      verticalAlign: "top",
                      wordBreak: "break-word",
                    }}
                  >
                    {lead.email}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: colors.amber,
                      verticalAlign: "top",
                    }}
                  >
                    ★ {lead.rating}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

const TableScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { index, localFrame } = activeSegment(
    frame,
    TABLE_SEGMENT_FRAMES,
    DEMO_SCENARIOS.length
  );
  const scenario = DEMO_SCENARIOS[index];
  const segmentFade =
    localFrame < 8
      ? interpolate(localFrame, [0, 8], [0.35, 1])
      : localFrame > TABLE_SEGMENT_FRAMES - 10
        ? interpolate(
            localFrame,
            [TABLE_SEGMENT_FRAMES - 10, TABLE_SEGMENT_FRAMES],
            [1, 0.35]
          )
        : 1;

  return (
    <AbsoluteFill
      style={{
        fontFamily: font,
        padding: "72px 80px",
        opacity: segmentFade,
      }}
    >
      <LeadsTable scenario={scenario} localFrame={localFrame} />
    </AbsoluteFill>
  );
};

const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        fontFamily: font,
        gap: 32,
        flexDirection: "row",
        display: "flex",
        padding: 100,
      }}
    >
      {FEATURES.map((f, i) => {
        const enter = spring({
          frame: frame - i * 12,
          fps: 30,
          config: { damping: 16 },
        });
        return (
          <div
            key={f.title}
            style={{
              flex: 1,
              ...glass,
              padding: 36,
              opacity: enter,
              transform: `translateY(${interpolate(enter, [0, 1], [32, 0])}px)`,
              boxShadow: "0 0 40px rgba(124,58,237,0.08)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${colors.violet}, ${colors.indigo})`,
                marginBottom: 20,
              }}
            />
            <h3 style={{ margin: 0, fontSize: 28, color: colors.white }}>
              {f.title}
            </h3>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 18,
                color: colors.muted,
                lineHeight: 1.5,
              }}
            >
              {f.desc}
            </p>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        fontFamily: font,
        textAlign: "center",
      }}
    >
      <div style={{ transform: `scale(${interpolate(scale, [0, 1], [0.94, 1])})` }}>
        <Logo size="lg" />
        <div
          style={{
            marginTop: 48,
            display: "inline-block",
            padding: "18px 40px",
            borderRadius: 14,
            background: `linear-gradient(135deg, ${colors.violet}, ${colors.indigo})`,
            fontSize: 26,
            fontWeight: 700,
            color: colors.white,
            boxShadow: "0 0 48px rgba(124,58,237,0.45)",
          }}
        >
          Start Finding Leads
        </div>
        <p style={{ marginTop: 28, fontSize: 22, color: colors.muted }}>
          leadpilot.app · Demo on your Mac in minutes
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const LeadPilotPromo: React.FC = () => {
  const searchDuration = SEARCH_SEGMENT_FRAMES * DEMO_SCENARIOS.length;
  const tableDuration = TABLE_SEGMENT_FRAMES * DEMO_SCENARIOS.length;

  return (
    <AbsoluteFill>
      <BrandBackground />
      <Sequence from={0} durationInFrames={90}>
        <IntroScene />
      </Sequence>
      <Sequence from={75} durationInFrames={195}>
        <FadeScene durationInFrames={195}>
          <HeroScene />
        </FadeScene>
      </Sequence>
      <Sequence from={250} durationInFrames={searchDuration + 30}>
        <FadeScene durationInFrames={searchDuration + 30}>
          <SearchScene />
        </FadeScene>
      </Sequence>
      <Sequence from={250 + searchDuration - 15} durationInFrames={tableDuration + 30}>
        <FadeScene durationInFrames={tableDuration + 30}>
          <TableScene />
        </FadeScene>
      </Sequence>
      <Sequence
        from={250 + searchDuration + tableDuration - 30}
        durationInFrames={150}
      >
        <FadeScene durationInFrames={150}>
          <FeaturesScene />
        </FadeScene>
      </Sequence>
      <Sequence
        from={250 + searchDuration + tableDuration + 120}
        durationInFrames={150}
      >
        <FadeScene durationInFrames={150}>
          <OutroScene />
        </FadeScene>
      </Sequence>
    </AbsoluteFill>
  );
};
