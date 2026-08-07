"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminLoginScreen } from "@/components/admin/admin-login-screen";
import { AdminSessionProvider, useAdminSession } from "@/components/admin/admin-session-context";
import { adminNavFromPath } from "@/components/admin/admin-sidebar";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAdminSession();

  if (!isAuthenticated) {
    return <AdminLoginScreen />;
  }

  return (
    <AdminShell activeNav={adminNavFromPath(pathname)}>{children}</AdminShell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminSessionProvider>
  );
}
