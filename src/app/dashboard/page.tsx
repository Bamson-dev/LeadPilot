import dynamic from "next/dynamic";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const SearchDashboard = dynamic(
  () =>
    import("@/components/dashboard/search-dashboard").then((m) => m.SearchDashboard),
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
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <SearchDashboard />
      </div>
      <Footer />
    </main>
  );
}
