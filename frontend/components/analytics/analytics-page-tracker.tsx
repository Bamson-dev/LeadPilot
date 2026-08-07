"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView, flushAnalytics } from "@/lib/analytics";

/**
 * Passive page-view tracker for App Router.
 * Mount once in a client layout; does not alter UI.
 */
export function AnalyticsPageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    return () => flushAnalytics();
  }, []);

  return null;
}
