"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DemoRecordingDashboard } from "./demo-recording-dashboard";
import { SearchDashboard } from "./search-dashboard";
import { getDeviceId } from "@/lib/device";
import { hasStoredLicense } from "@/lib/license";
import { getApiUrl } from "@/utils/env";

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

  useEffect(() => {
    if (!ready || searchParams.get("demo") === "recording") return;

    const email = localStorage.getItem("leadthur_email");
    const key = localStorage.getItem("leadthur_key");
    if (!email || !key) return;

    const deviceSignature = getDeviceId();
    if (!deviceSignature) return;

    const apiUrl = getApiUrl();
    if (!apiUrl) return;

    fetch(`${apiUrl}/auth/register-device`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, key, deviceSignature }),
    })
      .then(async (res) => {
        if (res.status === 403) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            code?: string;
          };
          if (data.code === "MAX_DEVICES") {
            localStorage.removeItem("leadthur_email");
            localStorage.removeItem("leadthur_key");
            const msg = encodeURIComponent(
              data.error ||
                "Maximum devices reached. Contact support on WhatsApp 09067285890."
            );
            window.location.href = `/activate?error=max_devices&message=${msg}`;
          }
        }
      })
      .catch(() => {
        /* silent — do not block dashboard */
      });
  }, [ready, searchParams]);

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
