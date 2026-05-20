import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const DashboardRouter = dynamic(
  () =>
    import("@/components/dashboard/dashboard-router").then(
      (m) => m.DashboardRouter
    ),
  {
    loading: () => (
      <div className="glass rounded-2xl p-8 text-center text-zinc-400">
        Loading LeadPilot dashboard…
      </div>
    ),
  }
);

export default function DashboardPage() {
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
          <DashboardRouter />
        </Suspense>
      </div>
      <Footer />
    </main>
  );
}
