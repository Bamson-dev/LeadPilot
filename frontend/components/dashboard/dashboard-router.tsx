"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DemoRecordingDashboard } from "./demo-recording-dashboard";
import { SearchDashboard } from "./search-dashboard";
import { hasStoredLicense } from "@/lib/license";

/**
 * /dashboard?demo=recording → auto-play screen recording demo
 * /dashboard → real scraper (requires activated license)
 */
export function DashboardRouter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
  }, [router, searchParams]);

  if (!ready) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-zinc-400">
        Checking access…
      </div>
    );
  }

  if (searchParams.get("demo") === "recording") {
    return <DemoRecordingDashboard />;
  }

  return <SearchDashboard />;
}
