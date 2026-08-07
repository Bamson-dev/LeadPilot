"use client";

import { useState } from "react";
import { AdminChipButton } from "@/components/admin/admin-ui";
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
      <div className="mb-3 inline-flex rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-1">
        <AdminChipButton
          active={activeTab === "signups"}
          onClick={() => setActiveTab("signups")}
        >
          Free Trial Signups
        </AdminChipButton>
        <AdminChipButton
          active={activeTab === "email-performance"}
          onClick={() => setActiveTab("email-performance")}
        >
          Email Performance
        </AdminChipButton>
      </div>

      {activeTab === "signups" ? (
        <TrialSignupsPanel onSessionExpired={onSessionExpired} />
      ) : (
        <TrialEmailPerformancePanel onSessionExpired={onSessionExpired} />
      )}
    </section>
  );
}
