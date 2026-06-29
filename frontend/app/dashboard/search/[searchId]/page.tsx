"use client";

import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import SearchResultPage from "./search-result-client";

export default function Page() {
  return (
    <main className="min-h-screen bg-[#09090B]">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 pt-20 pb-12 sm:px-6 sm:pt-24 sm:pb-16">
        <Suspense fallback={<p className="text-zinc-400">Loading…</p>}>
          <SearchResultPage />
        </Suspense>
      </div>
      <Footer />
    </main>
  );
}
