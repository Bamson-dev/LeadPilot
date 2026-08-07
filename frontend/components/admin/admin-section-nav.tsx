"use client";

import { cn } from "@/utils/utils";

const SECTIONS = [
  { id: "admin-queue", label: "Queue" },
  { id: "admin-activations", label: "Activations" },
  { id: "admin-scripts", label: "Scripts" },
  { id: "admin-overview", label: "Overview" },
  { id: "admin-users", label: "Users" },
  { id: "admin-payouts", label: "Payouts" },
  { id: "admin-trials", label: "Trials" },
  { id: "admin-tools", label: "Tools" },
  { id: "admin-blog", label: "Blog" },
  { id: "admin-access", label: "Access" },
  { id: "admin-licenses", label: "Licenses" },
] as const;

export function AdminSectionNav({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Admin sections"
      className={cn(
        "sticky top-0 z-30 -mx-4 mb-6 border-b border-[var(--lt-border)] bg-[var(--lt-bg)]/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6",
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto pb-1">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--lt-text-muted)] transition-colors hover:bg-[var(--lt-surface-3)] hover:text-[var(--lt-text)]"
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
