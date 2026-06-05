import { headers } from "next/headers";
import { DemoPageContent } from "./DemoPageContent";

export const dynamic = "force-dynamic";

function isStagingHost(host: string): boolean {
  const h = host.toLowerCase();
  return h.includes("staging.leadthur") || h.startsWith("staging-");
}

async function isDemoModeEnabled(): Promise<boolean> {
  if (
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  ) {
    return true;
  }

  // staging.leadthur.com is deployed on Vercel, not Coolify — env there must be
  // Preview-scoped, so also enable demo on the staging hostname directly.
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "";
  if (isStagingHost(host)) {
    return true;
  }

  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return false;
}

export default async function DemoPage() {
  if (!(await isDemoModeEnabled())) {
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
