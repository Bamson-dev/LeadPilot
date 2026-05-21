import dynamic from "next/dynamic";

const DashboardGate = dynamic(
  () =>
    import("@/components/dashboard/dashboard-gate").then((m) => m.DashboardGate),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-[#09090B]">
        <p className="text-sm text-[#6B6B80]">Loading…</p>
      </main>
    ),
  }
);

export default function DashboardPage() {
  return <DashboardGate />;
}
