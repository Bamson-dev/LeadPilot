"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { hasStoredLicense } from "@/lib/license";

function HomeRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const key = searchParams.get("key");

    if (hasStoredLicense()) {
      router.replace("/dashboard");
      return;
    }

    if (key) {
      router.replace(`/activate?key=${encodeURIComponent(key)}`);
      return;
    }

    router.replace("/activate");
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07070A]">
      <p className="text-sm text-[#6B6B80]">Loading LeadPilot…</p>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#07070A]">
          <p className="text-sm text-[#6B6B80]">Loading LeadPilot…</p>
        </main>
      }
    >
      <HomeRedirect />
    </Suspense>
  );
}
