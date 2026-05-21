"use client";

import { useEffect } from "react";
import { DashboardGate } from "@/components/dashboard/dashboard-gate";

export default function DashboardPage() {
  useEffect(() => {
    const email = localStorage.getItem("leadpilot_email");
    const key = localStorage.getItem("leadpilot_key");
    if (!email || !key) {
      window.location.href = "/activate";
    }
  }, []);

  return <DashboardGate />;
}
