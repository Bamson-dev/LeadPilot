"use client";

import { useEffect } from "react";
import { DashboardGate } from "@/components/dashboard/dashboard-gate";

export default function DashboardPage() {
  useEffect(() => {
    const email = localStorage.getItem("leadpilot_email");
    const key = localStorage.getItem("leadpilot_key");
    console.log("Dashboard loaded. License check:", {
      hasEmail: !!email,
      email,
      hasKey: !!key,
      keyPrefix: key ? key.substring(0, 8) : null,
    });

    if (!email || !key) {
      console.warn("No license credentials found. Redirecting to activate.");
      window.location.href = "/activate";
    }
  }, []);

  console.log("Dashboard env check:", {
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "(missing)",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "missing",
  });

  return <DashboardGate />;
}
