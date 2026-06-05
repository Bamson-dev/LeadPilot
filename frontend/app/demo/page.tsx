import { DemoPageContent } from "./DemoPageContent";

export const dynamic = "force-dynamic";

function isDemoModeEnabled(): boolean {
  return (
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  );
}

export default function DemoPage() {
  if (!isDemoModeEnabled()) {
    return (
      <div
        style={{
          background: "#050508",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          color: "#555570",
          fontSize: 14,
        }}
      >
        Page not found.
      </div>
    );
  }

  return <DemoPageContent />;
}
