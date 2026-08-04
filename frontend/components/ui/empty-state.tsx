import * as React from "react";
import { cn } from "@/utils/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--lt-border)] bg-[var(--lt-surface)] px-6 py-12 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--lt-surface-3)] text-[var(--lt-text-subtle)]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-medium text-[var(--lt-text)]">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-[var(--lt-text-muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
