"use client";

import dynamic from "next/dynamic";
import { Suspense, useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { hasStoredLicense } from "@/lib/license";

const DashboardRouter = dynamic(
  () =>
    import("@/components/dashboard/dashboard-router").then((m) => m.DashboardRouter),
  { ssr: false }
);

function AccessLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090B]">
      <p className="text-sm text-[#6B6B80]">Loading…</p>
    </main>
  );
}

function DashboardGateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "recording";
  const [allowed, setAllowed] = useState(false);

  useLayoutEffect(() => {
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
  }, [isDemo, router, searchParams]);

  if (!allowed) {
    return <AccessLoading />;
  }

  return (
    <main className="min-h-screen bg-[#09090B]">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 pt-20 pb-12 sm:px-6 sm:pt-24 sm:pb-16">
        <Suspense
          fallback={
            <div className="glass rounded-2xl p-8 text-center text-zinc-400">
              Loading…
            </div>
          }
        >
          <DashboardRouter skipAccessCheck />
        </Suspense>
      </div>
      <Footer />
    </main>
  );
}

export function DashboardGate() {
  return (
    <Suspense fallback={<AccessLoading />}>
      <DashboardGateInner />
    </Suspense>
  );
}
