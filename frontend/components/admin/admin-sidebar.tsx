"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Code2,
  CreditCard,
  FileText,
  Key,
  LayoutDashboard,
  Radio,
  Settings,
  Sparkles,
  Users,
  FlaskConical,
  Search,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/utils/utils";

export type AdminNavId =
  | "dashboard"
  | "trial"
  | "accounts"
  | "payments"
  | "licenses"
  | "broadcast"
  | "blog"
  | "content"
  | "email-campaigns"
  | "search-console"
  | "seo-intelligence"
  | "scripts"
  | "analytics"
  | "settings";

interface AdminNavItem {
  id: AdminNavId;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { id: "trial", label: "Trial", href: "/admin/trial", icon: FlaskConical },
  { id: "accounts", label: "Accounts", href: "/admin/accounts", icon: Users },
  { id: "payments", label: "Payments", href: "/admin/payments", icon: CreditCard },
  { id: "licenses", label: "Licenses", href: "/admin/licenses", icon: Key },
  { id: "broadcast", label: "Broadcast", href: "/admin/broadcast", icon: Radio },
  { id: "blog", label: "Blog", href: "/admin/blog", icon: FileText },
  { id: "content", label: "Content Automation", href: "/admin/content-automation", icon: Sparkles },
  { id: "email-campaigns", label: "Email Campaigns", href: "/admin/email-campaigns/ai-money-code", icon: Radio },
  { id: "search-console", label: "Search Console", href: "/admin/search-console", icon: Search },
  { id: "seo-intelligence", label: "SEO Intelligence", href: "/admin/seo-intelligence", icon: TrendingUp },
  { id: "scripts", label: "Global Scripts", href: "/admin/scripts", icon: Code2 },
  { id: "analytics", label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", href: "/admin/settings", icon: Settings },
];

export function adminNavFromPath(pathname: string): AdminNavId {
  const match = ADMIN_NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  if (match) return match.id;
  if (pathname === "/admin") return "dashboard";
  return "dashboard";
}

export function AdminSidebar({
  activeId,
  collapsed,
  onNavigate,
  className,
}: {
  activeId: AdminNavId;
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-[var(--lt-border)] bg-[var(--lt-surface)]",
        collapsed ? "w-[72px]" : "w-56",
        className
      )}
    >
      <div className={cn("border-b border-[var(--lt-border)] px-4 py-4", collapsed && "px-2")}>
        <p className={cn("text-sm font-bold text-[var(--lt-text)]", collapsed && "sr-only")}>
          LeadThur Admin
        </p>
        {!collapsed ? (
          <p className="mt-0.5 text-[10px] text-[var(--lt-text-subtle)]">RC1 control center</p>
        ) : null}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Admin workspaces">
        {ADMIN_NAV.map((item) => {
          const Icon = item.icon;
          const active =
            activeId === item.id ||
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--lt-accent)]/15 text-[var(--lt-accent-soft)]"
                  : "text-[var(--lt-text-muted)] hover:bg-[var(--lt-surface-3)] hover:text-[var(--lt-text)]",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
