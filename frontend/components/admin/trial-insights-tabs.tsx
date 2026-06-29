"use client";

import { useState } from "react";
import { TrialSignupsPanel } from "./trial-signups-panel";
import { TrialEmailPerformancePanel } from "./trial-email-performance-panel";

export function TrialInsightsTabs({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"signups" | "email-performance">("signups");

  return (
    <section className="mt-8">
      <div className="mb-3 inline-flex rounded-lg border border-white/10 bg-[#111118] p-1">
        <button
          type="button"
          onClick={() => setActiveTab("signups")}
          className="rounded-md px-3 py-1.5 text-xs font-semibold transition"
          style={{
            background: activeTab === "signups" ? "#7C3AED" : "transparent",
            color: activeTab === "signups" ? "#ffffff" : "#C0C0D8",
          }}
        >
          Free Trial Signups
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("email-performance")}
          className="rounded-md px-3 py-1.5 text-xs font-semibold transition"
          style={{
            background: activeTab === "email-performance" ? "#7C3AED" : "transparent",
            color: activeTab === "email-performance" ? "#ffffff" : "#C0C0D8",
          }}
        >
          Email Performance
        </button>
      </div>

      {activeTab === "signups" ? (
        <TrialSignupsPanel onSessionExpired={onSessionExpired} />
      ) : (
        <TrialEmailPerformancePanel onSessionExpired={onSessionExpired} />
      )}
    </section>
  );
}
