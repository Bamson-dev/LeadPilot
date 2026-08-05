"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell";
import type { SavedListPreview, ShellNavId } from "@/components/shell";
import { hasStoredLicense } from "@/lib/license";
import { getLicenseUsage, getRecentActivity } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";

const DashboardRouter = dynamic(
  () =>
    import("@/components/dashboard/dashboard-router").then((m) => m.DashboardRouter),
  { ssr: false }
);

function AccessLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--lt-bg)]">
      <div className="flex w-64 flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </main>
  );
}

function viewToNav(view: string | null): ShellNavId {
  switch (view) {
    case "outreach":
      return "outreach";
    case "mailbox":
      return "mailbox";
    case "insights":
      return "insights";
    case "affiliate":
      return "affiliate";
    case "workspace":
      return "workspace";
    case "discover":
      return "discovery";
    default:
      return "discovery";
  }
}

function DashboardGateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "recording";
  const view = searchParams.get("view");
  const [allowed, setAllowed] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [savedLists, setSavedLists] = useState<SavedListPreview[]>([]);

  useLayoutEffect(() => {
    if (view === "outreach") {
      router.replace("/dashboard/outreach");
      return;
    }
    if (view === "mailbox") {
      router.replace("/dashboard/mailboxes");
      return;
    }
    if (view === "insights") {
      router.replace("/dashboard/insights");
      return;
    }
    if (view === "affiliate") {
      router.replace("/dashboard/affiliate");
      return;
    }

    if (isDemo) {
      setAllowed(true);
      return;
    }

    if (!hasStoredLicense()) {
      const key = searchParams.get("key");
      router.replace(
        key ? `/activate?key=${encodeURIComponent(key)}` : "/activate"
      );
      return;
    }

    setAllowed(true);
  }, [isDemo, router, searchParams, view]);

  useEffect(() => {
    if (!allowed || isDemo) return;
    setEmail(localStorage.getItem("leadthur_email"));
    void (async () => {
      const usage = await getLicenseUsage();
      if (usage) setCredits(usage.search_credits);

      try {
        const { activity } = await getRecentActivity();
        setSavedLists(
          (activity || []).slice(0, 6).map((item, index) => ({
            id: `${item.query}-${item.location}-${index}`,
            name: `${item.query} · ${item.location}`.slice(0, 40),
            count: item.total_found || 0,
            href: "/dashboard",
          }))
        );
      } catch {
        // non-blocking
      }
    })();
  }, [allowed, isDemo]);

  if (!allowed) {
    return <AccessLoading />;
  }

  return (
    <AppShell
      credits={credits}
      userEmail={email}
      savedLists={savedLists}
      activeNav={viewToNav(view)}
      contentClassName="px-4 pt-4 sm:px-6"
    >
      <Suspense
        fallback={
          <div className="rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface)] p-8">
            <Skeleton className="mb-4 h-6 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <DashboardRouter skipAccessCheck />
      </Suspense>
    </AppShell>
  );
}

export function DashboardGate() {
  return (
    <Suspense fallback={<AccessLoading />}>
      <DashboardGateInner />
    </Suspense>
  );
}
