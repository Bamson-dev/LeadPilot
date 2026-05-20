"use client";

import { useSearchParams } from "next/navigation";
import { DemoRecordingDashboard } from "./demo-recording-dashboard";
import { SearchDashboard } from "./search-dashboard";

/**
 * /dashboard?demo=recording → auto-play screen recording demo (scan + generate overlap)
 * /dashboard → real scraper
 */
export function DashboardRouter() {
  const searchParams = useSearchParams();

  if (searchParams.get("demo") === "recording") {
    return <DemoRecordingDashboard />;
  }

  return <SearchDashboard />;
}
