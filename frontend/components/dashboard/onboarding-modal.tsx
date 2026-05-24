"use client";

const onboardingSteps = [
  {
    title: "Welcome to LeadPilot 👋",
    body: "You are about to find your first business leads. This takes less than 60 seconds. Let us walk you through it quickly.",
  },
  {
    title: "Type any business",
    body: "Enter any type of business you want to find. Restaurants, salons, law firms, hotels, gyms, real estate companies. Whatever kind of client you are looking for.",
  },
  {
    title: "Type any city in the world",
    body: "Enter any city anywhere. Lagos, Abuja, London, Dubai, Nairobi. LeadPilot covers over 195 countries. The more specific the city the more results you get.",
  },
  {
    title: "Watch results appear live",
    body: "Real businesses with phone numbers, emails, and addresses stream onto your screen in real time. Download them all as a CSV when done and start reaching out today.",
  },
];

interface OnboardingModalProps {
  open: boolean;
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

export function OnboardingModal({ open, step, onNext, onSkip }: OnboardingModalProps) {
  if (!open) return null;

  const current = onboardingSteps[step];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#111118",
          border: "1px solid rgba(124,58,237,0.35)",
          borderRadius: 20,
          padding: 28,
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 0 80px rgba(124,58,237,0.2)",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 24,
          }}
        >
          {onboardingSteps.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 100,
                background: i <= step ? "#7C3AED" : "rgba(255,255,255,0.08)",
                transition: "background 0.3s ease",
              }}
            />
          ))}
        </div>

        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#A78BFA",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Step {step + 1} of {onboardingSteps.length}
        </p>

        <h3
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "#F0EFFF",
            marginBottom: 12,
            letterSpacing: -0.5,
            lineHeight: 1.2,
          }}
        >
          {current.title}
        </h3>

        <p
          style={{
            fontSize: 14,
            color: "#7878A0",
            lineHeight: 1.75,
            marginBottom: 28,
          }}
        >
          {current.body}
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={onNext}
            style={{
              flex: 1,
              background: "#7C3AED",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "14px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 0 30px rgba(124,58,237,0.3)",
              transition: "background 0.2s",
            }}
          >
            {step < onboardingSteps.length - 1
              ? "Next →"
              : "Got it. Let me search →"}
          </button>

          <button
            type="button"
            onClick={onSkip}
            style={{
              background: "transparent",
              border: "none",
              color: "#555575",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              padding: "14px 8px",
              whiteSpace: "nowrap",
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
