"use client";

import { useEffect } from "react";
import { DashboardGate } from "@/components/dashboard/dashboard-gate";
import { getApiUrl } from "@/utils/env";

function redirectSuspended(reason: string) {
  localStorage.setItem("lp_suspended_reason", reason);
  localStorage.removeItem("leadpilot_email");
  localStorage.removeItem("leadpilot_key");
  window.location.href = "/suspended";
}

function clearLicenseAndRedirectActivate() {
  localStorage.removeItem("leadpilot_email");
  localStorage.removeItem("leadpilot_key");
  window.location.href = "/activate";
}

export default function DashboardPage() {
  useEffect(() => {
    const email = localStorage.getItem("leadpilot_email");
    const key = localStorage.getItem("leadpilot_key");

    if (!email || !key) {
      window.location.href = "/activate";
      return;
    }

    const apiUrl = getApiUrl();
    if (!apiUrl) return;

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
    const interval = setInterval(() => void checkAccountStatus(), 60_000);
    return () => clearInterval(interval);
  }, []);

  return <DashboardGate />;
}
