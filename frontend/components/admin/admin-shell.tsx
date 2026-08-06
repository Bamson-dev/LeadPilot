"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Bricolage_Grotesque } from "next/font/google";
import {
  AdminSidebar,
  ADMIN_NAV,
  adminNavFromPath,
  type AdminNavId,
} from "@/components/admin/admin-sidebar";
import { useAdminSession } from "@/components/admin/admin-session-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePathname } from "next/navigation";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const MOBILE_NAV: AdminNavId[] = [
  "dashboard",
  "trial",
  "accounts",
  "payments",
  "licenses",
];

export function AdminShell({
  children,
  activeNav,
  className,
  contentClassName,
}: {
  children: ReactNode;
  activeNav?: AdminNavId;
  className?: string;
  contentClassName?: string;
}) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const isTablet = useIsMobile(1024);
  const { logout } = useAdminSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const navId = activeNav ?? adminNavFromPath(pathname);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onResize = () => {
      setCollapsed(window.innerWidth >= 768 && window.innerWidth < 1280);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const sidebar = (
    <AdminSidebar
      activeId={navId}
      collapsed={!isMobile && !isTablet && collapsed}
      onNavigate={() => setDrawerOpen(false)}
    />
  );

  return (
    <div className={cn("admin-rc1 flex min-h-screen bg-[var(--lt-bg)] text-[var(--lt-text)]", className)}>
      {!isMobile && !isTablet ? (
        <div className="sticky top-0 hidden h-screen shrink-0 md:block">{sidebar}</div>
      ) : null}

      {drawerOpen && (isMobile || isTablet) ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 shadow-xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--lt-border)] bg-[var(--lt-bg)]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {(isMobile || isTablet) && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
              >
                {drawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            )}
            <div className="min-w-0">
              <p className={`${bricolage.className} truncate text-lg font-bold text-[var(--lt-text)]`}>
                {ADMIN_NAV.find((item) => item.id === navId)?.label ?? "Admin"}
              </p>
              <p className="truncate text-[11px] text-[var(--lt-text-subtle)]">
                JWT admin console — existing workflows only
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={logout}>
            Logout
          </Button>
        </header>

        <main
          className={cn(
            "flex-1 overflow-auto px-4 py-6 pb-24 sm:px-6 md:pb-6",
            contentClassName
          )}
        >
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {isMobile && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t border-[var(--lt-border)] bg-[var(--lt-surface)] px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Admin mobile"
        >
          {MOBILE_NAV.map((id) => {
            const item = ADMIN_NAV.find((nav) => nav.id === id);
            if (!item) return null;
            const Icon = item.icon;
            const active = navId === id;
            return (
              <Link
                key={id}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  active ? "text-[var(--lt-accent-soft)]" : "text-[var(--lt-text-subtle)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-10 items-center justify-center rounded-md",
                    active && "bg-[var(--lt-accent)]/15"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[var(--lt-text-subtle)]"
          >
            <span className="flex h-8 w-10 items-center justify-center rounded-md">
              <Menu className="h-4 w-4" />
            </span>
            More
          </button>
        </nav>
      )}
    </div>
  );
}
