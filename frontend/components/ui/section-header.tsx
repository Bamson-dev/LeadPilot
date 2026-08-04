import * as React from "react";
import { cn } from "@/utils/utils";

export interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  description?: string;
  className?: string;
}

function SectionHeader({
  title,
  action,
  description,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-[var(--lt-text)]">
          {title}
        </h2>
        {action ? (
          <div className="shrink-0 text-sm text-[var(--lt-cyan)]">{action}</div>
        ) : null}
      </div>
      {description ? (
        <p className="text-sm text-[var(--lt-text-muted)]">{description}</p>
      ) : null}
    </div>
  );
}

export { SectionHeader };
