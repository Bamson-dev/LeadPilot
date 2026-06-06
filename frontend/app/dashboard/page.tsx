"use client";

import { useEffect, useState } from "react";
import { DashboardGate } from "@/components/dashboard/dashboard-gate";
import { OnboardingModal } from "@/components/dashboard/onboarding-modal";
import { getApiUrl } from "@/utils/env";

function redirectSuspended(reason: string) {
  localStorage.setItem("lp_suspended_reason", reason);
  window.location.href = "/suspended";
}

function clearLicenseAndRedirectActivate() {
  localStorage.removeItem("leadthur_email");
  localStorage.removeItem("leadthur_key");
  window.location.href = "/activate";
}

export default function DashboardPage() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [topUpSuccess, setTopUpSuccess] = useState(false);

  function completeOnboarding() {
    setShowOnboarding(false);
    setOnboardingStep(0);
    localStorage.setItem("lp_onboarding_done", "true");
  }

  function nextOnboardingStep() {
    if (onboardingStep < 3) {
      setOnboardingStep((prev) => prev + 1);
    } else {
      completeOnboarding();
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") === "success") {
      setTopUpSuccess(true);
      window.history.replaceState({}, "", "/dashboard");
      window.dispatchEvent(new CustomEvent("leadthur:topup-success"));
    }
  }, []);

  useEffect(() => {
    const email = localStorage.getItem("leadthur_email");
    const key = localStorage.getItem("leadthur_key");

    if (!email || !key) {
      window.location.href = "/activate";
      return;
    }

    let onboardingTimer: ReturnType<typeof setTimeout> | undefined;
    const onboardingDone = localStorage.getItem("lp_onboarding_done");
    if (!onboardingDone) {
      onboardingTimer = setTimeout(() => setShowOnboarding(true), 1500);
    }

    const apiUrl = getApiUrl();
    if (!apiUrl) {
      return () => {
        if (onboardingTimer) clearTimeout(onboardingTimer);
      };
    }

    async function checkAccountStatus() {
      try {
        const res = await fetch(`${apiUrl}/auth/status`, {
          headers: {
            "x-license-key": key!,
            "x-license-email": email!,
          },
        });

        const data = (await res.json()) as {
          valid?: boolean;
          reason?: string;
          code?: string;
        };

        if (!data.valid) {
          if (data.code === "SUSPENDED") {
            redirectSuspended(
              data.reason ||
                "Your account has been suspended. Contact support on WhatsApp 09067285890."
            );
            return;
          }

          if (
            data.code === "INVALID_LICENSE" ||
            data.code === "NO_LICENSE" ||
            data.code === "NOT_ACTIVATED"
          ) {
            clearLicenseAndRedirectActivate();
            return;
          }
        }
      } catch {
        // Silent fail — do not log out on network error
      }
    }

    void checkAccountStatus();
    const interval = setInterval(() => void checkAccountStatus(), 30_000);
    return () => {
      if (onboardingTimer) clearTimeout(onboardingTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      {topUpSuccess && (
        <div
          style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 10,
            padding: "12px 20px",
            fontSize: 13,
            color: "#10B981",
            fontWeight: 600,
            margin: "16px 16px 0",
            display: "flex",
            alignItems: "center",
            gap: 8,
            maxWidth: 1200,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <span>✓</span>
          Top up successful. Your credits have been added. Keep searching.
          <button
            type="button"
            onClick={() => setTopUpSuccess(false)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "#10B981",
              cursor: "pointer",
              fontSize: 16,
              fontFamily: "Inter, sans-serif",
            }}
          >
            ✕
          </button>
        </div>
      )}
      <DashboardGate />
      <OnboardingModal
        open={showOnboarding}
        step={onboardingStep}
        onNext={nextOnboardingStep}
        onSkip={completeOnboarding}
      />
    </>
  );
}
