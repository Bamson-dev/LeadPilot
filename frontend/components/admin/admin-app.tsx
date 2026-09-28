"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminLoginScreen } from "@/components/admin/admin-login-screen";
import { AdminSessionProvider, useAdminSession } from "@/components/admin/admin-session-context";
import { adminNavFromPath } from "@/components/admin/admin-sidebar";

function AdminAppInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, ready } = useAdminSession();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--lt-bg)] text-sm text-[var(--lt-text-subtle)]">
        Loading admin…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLoginScreen />;
  }

  return (
    <AdminShell activeNav={adminNavFromPath(pathname)}>{children}</AdminShell>
  );
}

export function AdminApp({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminAppInner>{children}</AdminAppInner>
    </AdminSessionProvider>
  );
}
