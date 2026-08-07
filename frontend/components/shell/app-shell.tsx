"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/utils/utils";
import { AppSidebar, type SavedListPreview, type ShellNavId } from "@/components/shell/app-sidebar";
import { AppTopNav } from "@/components/shell/app-top-nav";
import { Toaster } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  Compass,
  FolderOpen,
  Inbox,
  Send,
  User,
} from "lucide-react";
import Link from "next/link";

export interface AppShellProps {
  children: React.ReactNode;
  credits?: number | null;
  userEmail?: string | null;
  savedLists?: SavedListPreview[];
  activeNav?: ShellNavId;
  className?: string;
  contentClassName?: string;
}

const MOBILE_TABS: { id: ShellNavId; label: string; href: string; icon: typeof Compass }[] = [
  { id: "discovery", label: "Discovery", href: "/dashboard", icon: Compass },
  { id: "workspace", label: "Saved", href: "/dashboard/saved", icon: FolderOpen },
  { id: "outreach", label: "Outreach", href: "/dashboard/outreach", icon: Send },
  { id: "mailbox", label: "Mailbox", href: "/dashboard/mailboxes", icon: Inbox },
];

export function AppShell({
  children,
  credits,
  userEmail,
  savedLists,
  activeNav = "discovery",
  className,
  contentClassName,
}: AppShellProps) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onResize = () => {
      setCollapsed(window.innerWidth < 1280 && window.innerWidth >= 768);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      className={cn(
        "flex min-h-screen bg-[var(--lt-bg)] text-[var(--lt-text)]",
        className
      )}
    >
      {!isMobile && (
        <div className="sticky top-0 hidden h-screen shrink-0 md:block">
          <AppSidebar
            collapsed={collapsed}
            savedLists={savedLists}
            activeId={activeNav}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopNav
          credits={credits}
          userEmail={userEmail}
          onCreditsClick={() => router.push("/dashboard/plans")}
        />
        <main
          className={cn(
            "flex-1 overflow-auto pb-20 md:pb-6",
            contentClassName
          )}
        >
          {children}
        </main>
      </div>

      {isMobile && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t border-[var(--lt-border)] bg-[var(--lt-surface)] px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Mobile"
        >
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeNav;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  active ? "text-[var(--lt-cyan)]" : "text-[var(--lt-text-subtle)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-10 items-center justify-center rounded-md",
                    active && "bg-[var(--lt-cyan-soft)]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {tab.label}
              </Link>
            );
          })}
          <Link
            href="/dashboard/plans"
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              activeNav === "billing" || activeNav === "account"
                ? "text-[var(--lt-cyan)]"
                : "text-[var(--lt-text-subtle)]"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-10 items-center justify-center rounded-md",
                (activeNav === "billing" || activeNav === "account") &&
                  "bg-[var(--lt-cyan-soft)]"
              )}
            >
              <User className="h-4 w-4" />
            </span>
            Billing
          </Link>
        </nav>
      )}

      <Toaster />
    </div>
  );
}
