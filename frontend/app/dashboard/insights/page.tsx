"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import type { SavedListPreview } from "@/components/shell";
import { InsightsPageWorkspace } from "@/components/insights/insights-page-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { getLicenseUsage, getSearchHistory } from "@/services/api";
import { hasStoredLicense } from "@/lib/license";
import { historyToSavedLists } from "@/lib/saved-leads";

function InsightsPageInner() {
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [savedLists, setSavedLists] = useState<SavedListPreview[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasStoredLicense()) {
      router.replace("/activate");
      return;
    }
    setEmail(localStorage.getItem("leadthur_email"));
    setReady(true);
    void getLicenseUsage().then((usage) => {
      if (usage) setCredits(usage.search_credits);
    });
    void getSearchHistory().then((data) => {
      setSavedLists(
        historyToSavedLists(data.history ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          count: item.count,
          href: "/dashboard/saved",
        }))
      );
    });
  }, [router]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--lt-bg)]">
        <Skeleton className="h-8 w-48" />
      </main>
    );
  }

  return (
    <AppShell
      credits={credits}
      userEmail={email}
      savedLists={savedLists}
      activeNav="insights"
      contentClassName="px-4 pt-4 sm:px-6"
    >
      <InsightsPageWorkspace />
    </AppShell>
  );
}

export default function InsightsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--lt-bg)]">
          <Skeleton className="h-8 w-48" />
        </main>
      }
    >
      <InsightsPageInner />
    </Suspense>
  );
}
