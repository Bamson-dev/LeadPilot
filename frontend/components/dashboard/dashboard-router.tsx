"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DemoRecordingDashboard } from "./demo-recording-dashboard";
import { SearchDashboard } from "./search-dashboard";
import { hasStoredLicense } from "@/lib/license";

/**
 * /dashboard?demo=recording → auto-play screen recording demo
 * /dashboard → real scraper (requires activated license; gate is DashboardGate)
 */
export function DashboardRouter({ skipAccessCheck = false }: { skipAccessCheck?: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [ready, setReady] = useState(skipAccessCheck);

  useEffect(() => {
    if (skipAccessCheck) {
      setReady(true);
      return;
    }

    if (searchParams.get("demo") === "recording") {
      setReady(true);
      return;
    }

    if (!hasStoredLicense()) {
      const key = searchParams.get("key");
      router.replace(key ? `/activate?key=${encodeURIComponent(key)}` : "/activate");
      return;
    }

    setReady(true);
  }, [router, searchParams, skipAccessCheck]);

  if (!ready) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-zinc-400">
        Loading…
      </div>
    );
  }

  if (searchParams.get("demo") === "recording") {
    return <DemoRecordingDashboard />;
  }

  return <SearchDashboard />;
}
