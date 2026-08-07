"use client";

import { cn } from "@/utils/utils";

export interface AdminWorkspaceHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badges?: React.ReactNode;
  className?: string;
}

export function AdminWorkspaceHeader({
  title,
  description,
  actions,
  badges,
  className,
}: AdminWorkspaceHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-[var(--lt-border)] pb-5 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-[var(--lt-text)]">
            {title}
          </h1>
          {badges}
        </div>
        {description ? (
          <p className="mt-1 text-sm text-[var(--lt-text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
