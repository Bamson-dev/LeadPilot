import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        active:
          "border-[var(--lt-success)]/30 bg-[var(--lt-success-soft)] text-[var(--lt-success)]",
        paused:
          "border-[var(--lt-border)] bg-[var(--lt-surface-3)] text-[var(--lt-text-muted)]",
        enriched:
          "border-[var(--lt-cyan)]/30 bg-[var(--lt-cyan-soft)] text-[var(--lt-cyan)]",
        replied:
          "border-[var(--lt-accent)]/30 bg-[var(--lt-accent)]/10 text-[var(--lt-accent-soft)]",
        processing:
          "border-[var(--lt-warning)]/30 bg-[var(--lt-warning-soft)] text-[var(--lt-warning)]",
        error:
          "border-[var(--lt-danger)]/30 bg-[var(--lt-danger-soft)] text-[var(--lt-danger)]",
      },
    },
    defaultVariants: {
      status: "active",
    },
  }
);

const dotVariants = cva("h-1.5 w-1.5 shrink-0 rounded-full", {
  variants: {
    status: {
      active: "bg-[var(--lt-success)]",
      paused: "bg-[var(--lt-text-subtle)]",
      enriched: "bg-[var(--lt-cyan)]",
      replied: "bg-[var(--lt-accent-soft)]",
      processing: "bg-[var(--lt-warning)] status-pulse-dot",
      error: "bg-[var(--lt-danger)]",
    },
  },
  defaultVariants: {
    status: "active",
  },
});

export type StatusBadgeStatus = NonNullable<
  VariantProps<typeof statusBadgeVariants>["status"]
>;

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  label?: string;
}

function StatusBadge({
  className,
  status = "active",
  label,
  children,
  ...props
}: StatusBadgeProps) {
  const content = label ?? children;

  return (
    <span
      className={cn(statusBadgeVariants({ status }), className)}
      {...props}
    >
      <span className={cn(dotVariants({ status }))} aria-hidden="true" />
      {content}
    </span>
  );
}

export { StatusBadge, statusBadgeVariants };
