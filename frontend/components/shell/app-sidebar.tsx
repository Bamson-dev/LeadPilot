"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  FolderOpen,
  Send,
  Inbox,
  BarChart3,
  User,
  LifeBuoy,
  Code2,
  Plus,
} from "lucide-react";
import { cn } from "@/utils/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export type ShellNavId =
  | "home"
  | "discovery"
  | "workspace"
  | "outreach"
  | "mailbox"
  | "insights"
  | "account"
  | "affiliate"
  | "billing";

interface NavItem {
  id: ShellNavId;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (pathname: string) => boolean;
}

const PRIMARY_NAV: NavItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/dashboard",
    icon: Home,
    match: (p) => p === "/dashboard",
  },
  {
    id: "discovery",
    label: "Discovery",
    href: "/dashboard",
    icon: Compass,
    match: (p) => p === "/dashboard" || p.startsWith("/dashboard/search"),
  },
  {
    id: "workspace",
    label: "Saved Leads",
    href: "/dashboard/saved",
    icon: FolderOpen,
    match: (p) => p.startsWith("/dashboard/saved"),
  },
  {
    id: "outreach",
    label: "Outreach",
    href: "/dashboard?view=outreach",
    icon: Send,
  },
  {
    id: "mailbox",
    label: "Mailbox",
    href: "/dashboard?view=mailbox",
    icon: Inbox,
  },
  {
    id: "insights",
    label: "Insights",
    href: "/dashboard?view=insights",
    icon: BarChart3,
  },
  {
    id: "account",
    label: "Account",
    href: "/dashboard/plans",
    icon: User,
    match: (p) => p.startsWith("/dashboard/plans"),
  },
];

export interface SavedListPreview {
  id: string;
  name: string;
  count: number;
  href?: string;
}

export interface AppSidebarProps {
  creditsLabel?: string;
  savedLists?: SavedListPreview[];
  activeId?: ShellNavId;
  onNavigate?: (id: ShellNavId) => void;
  className?: string;
  collapsed?: boolean;
}

function isActive(item: NavItem, pathname: string, activeId?: ShellNavId) {
  if (activeId) return item.id === activeId;
  if (item.match) return item.match(pathname);
  return false;
}

export function AppSidebar({
  savedLists = [],
  activeId,
  onNavigate,
  className,
  collapsed = false,
}: AppSidebarProps) {
  const pathname = usePathname() || "/dashboard";

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-[var(--lt-border)] bg-[var(--lt-bg)]",
        collapsed ? "w-[var(--lt-sidebar-collapsed)]" : "w-[var(--lt-sidebar-width)]",
        className
      )}
      aria-label="Primary"
    >
      <div className={cn("flex h-[var(--lt-header-height)] items-center px-4", collapsed && "justify-center px-2")}>
        <Link href="/dashboard" className="flex items-center gap-2 truncate">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--lt-accent)] text-xs font-bold text-white">
            LT
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight text-[var(--lt-text)]">
              LeadThur V2
            </span>
          )}
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item, pathname, activeId);
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => onNavigate?.(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                collapsed && "justify-center px-2",
                active
                  ? "bg-[var(--lt-cyan)] text-[var(--lt-bg)]"
                  : "text-[var(--lt-text-muted)] hover:bg-[var(--lt-surface-3)] hover:text-[var(--lt-text)]"
              )}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        {!collapsed && savedLists.length > 0 && (
          <>
            <Separator className="my-3 bg-[var(--lt-border)]" />
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--lt-text-subtle)]">
              Saved lists
            </p>
            {savedLists.slice(0, 6).map((list) => (
              <Link
                key={list.id}
                href={list.href || "/dashboard"}
                className="flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm text-[var(--lt-text-muted)] hover:bg-[var(--lt-surface-3)] hover:text-[var(--lt-text)]"
              >
                <span className="truncate">{list.name}</span>
                <span className="rounded-full bg-[var(--lt-surface-3)] px-2 py-0.5 text-[11px] text-[var(--lt-text-subtle)]">
                  {list.count > 999 ? `${(list.count / 1000).toFixed(1)}k` : list.count}
                </span>
              </Link>
            ))}
            <button
              type="button"
              className="mt-1 flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-[var(--lt-accent-soft)] hover:bg-[var(--lt-surface-3)]"
            >
              <Plus className="h-3.5 w-3.5" />
              New list
            </button>
          </>
        )}
      </nav>

      <div className={cn("mt-auto space-y-2 border-t border-[var(--lt-border)] p-3", collapsed && "px-2")}>
        {!collapsed ? (
          <Button variant="soft" className="w-full justify-center" asChild>
            <Link href="/dashboard/plans">Upgrade Plan</Link>
          </Button>
        ) : (
          <Button variant="soft" size="icon" className="w-full" asChild>
            <Link href="/dashboard/plans" title="Upgrade Plan">
              <Plus className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <div className={cn("flex flex-col gap-1", collapsed && "items-center")}>
          <Link
            href="https://wa.me/2349067285890"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--lt-text-muted)] hover:text-[var(--lt-text)]"
          >
            <LifeBuoy className="h-3.5 w-3.5" />
            {!collapsed && "Support"}
          </Link>
          <span className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--lt-text-subtle)]">
            <Code2 className="h-3.5 w-3.5" />
            {!collapsed && "API"}
          </span>
        </div>
      </div>
    </aside>
  );
}
