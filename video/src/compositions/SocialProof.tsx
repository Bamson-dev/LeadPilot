import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants/theme";
import { CounterAnimation } from "../components/CounterAnimation";

const START = 1950;
const END = 2250;

const SOCIAL_STATS = [
  { number: "500+", label: "Users" },
  { number: "195", label: "Countries" },
  { number: "10,000+", label: "Leads Per Search" },
];

export const SocialProof: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < START || frame >= END) return null;

  const localFrame = frame - START;

  const fadeOut = interpolate(localFrame, [210, 300], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowPulse = interpolate(localFrame, [210, 240, 270], [0, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, sans-serif",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 60px",
        opacity: fadeOut,
      }}
    >
      {localFrame >= 210 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at center, ${COLORS.accentGlow} 0%, transparent 60%)`,
            opacity: glowPulse,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Stars */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const starProgress = spring({
            frame: localFrame - i * 10,
            fps,
            config: { mass: 0.5, damping: 12, stiffness: 150 },
          });
          const sparkle = localFrame > i * 10 + 5 && localFrame < i * 10 + 20;
          return (
            <div key={i} style={{ position: "relative" }}>
              <div
                style={{
                  fontSize: 40,
                  color: COLORS.gold,
                  opacity: starProgress,
                  transform: `scale(${interpolate(starProgress, [0, 1], [0.3, 1])})`,
                }}
              >
                ★
              </div>
              {sparkle && (
                <div
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    fontSize: 14,
                    opacity: interpolate(localFrame - i * 10 - 5, [0, 15], [1, 0], {
                      extrapolateRight: "clamp",
                    }),
                  }}
                >
                  ✨
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Testimonial */}
      {localFrame >= 60 && (
        <div style={{ textAlign: "center", maxWidth: 800, marginBottom: 48 }}>
          <div
            style={{
              fontSize: 24,
              fontStyle: "italic",
              color: COLORS.white,
              lineHeight: 1.6,
              opacity: interpolate(localFrame, [60, 80], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            &ldquo;I searched salons in Abuja and got 140 contacts in under a minute. Closed 2 clients
            before evening.&rdquo;
          </div>
          <div
            style={{
              fontSize: 16,
              color: COLORS.muted,
              marginTop: 16,
              opacity: interpolate(localFrame, [75, 95], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            Adewale O. — Web Designer, Lagos
          </div>
        </div>
      )}

      {/* Stats bar */}
      {localFrame >= 150 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            background: COLORS.surfaceAlt,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: "24px 0",
            width: "100%",
            maxWidth: 800,
            transform: `translateY(${interpolate(localFrame, [150, 180], [60, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
            opacity: interpolate(localFrame, [150, 170], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {SOCIAL_STATS.map((stat, i) => (
            <React.Fragment key={stat.label}>
              {i > 0 && (
                <div
                  style={{
                    width: 1,
                    height: 40,
                    background: COLORS.border,
                  }}
                />
              )}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900 }}>
                  <CounterAnimation value={stat.number} duration={30} delay={150 + i * 20} />
                </div>
                <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>{stat.label}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};
