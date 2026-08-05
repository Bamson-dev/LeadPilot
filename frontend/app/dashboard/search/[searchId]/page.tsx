"use client";

import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/shell";
import SearchResultPage from "./search-result-client";
import { getLicenseUsage } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  const [credits, setCredits] = useState<number | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setEmail(localStorage.getItem("leadthur_email"));
    void getLicenseUsage().then((usage) => {
      if (usage) setCredits(usage.search_credits);
    });
  }, []);

  return (
    <AppShell
      credits={credits}
      userEmail={email}
      activeNav="discovery"
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
        <SearchResultPage />
      </Suspense>
    </AppShell>
  );
}
