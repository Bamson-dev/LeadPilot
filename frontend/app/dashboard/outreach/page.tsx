"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell";
import type { SavedListPreview, ShellNavId } from "@/components/shell";
import { OutreachPageWorkspace } from "@/components/outreach/outreach-page-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { getLicenseUsage, getSearchHistory } from "@/services/api";
import { hasStoredLicense } from "@/lib/license";
import { historyToSavedLists } from "@/lib/saved-leads";

function navFromTab(tab: string | null): ShellNavId {
  if (tab === "mailboxes" || tab === "mailbox") return "mailbox";
  return "outreach";
}

function OutreachPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [credits, setCredits] = useState<number | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [savedLists, setSavedLists] = useState<SavedListPreview[]>([]);
  const [ready, setReady] = useState(false);
  const [activeNav, setActiveNav] = useState<ShellNavId>(() =>
    navFromTab(searchParams.get("tab") || searchParams.get("view"))
  );

  const handleTabChange = useCallback((tab: string) => {
    setActiveNav(navFromTab(tab));
  }, []);

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
      activeNav={activeNav}
      contentClassName="px-4 pt-4 sm:px-6"
    >
      <OutreachPageWorkspace onTabChange={handleTabChange} />
    </AppShell>
  );
}

export default function OutreachPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--lt-bg)]">
          <Skeleton className="h-8 w-48" />
        </main>
      }
    >
      <OutreachPageInner />
    </Suspense>
  );
}
