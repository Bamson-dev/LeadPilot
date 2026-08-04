import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--lt-accent)] text-white",
        cyan:
          "border-transparent bg-[var(--lt-cyan-soft)] text-[var(--lt-cyan)]",
        success:
          "border-transparent bg-[var(--lt-success-soft)] text-[var(--lt-success)]",
        warning:
          "border-transparent bg-[var(--lt-warning-soft)] text-[var(--lt-warning)]",
        danger:
          "border-transparent bg-[var(--lt-danger-soft)] text-[var(--lt-danger)]",
        outline:
          "border-[var(--lt-border)] bg-transparent text-[var(--lt-text)]",
        muted:
          "border-transparent bg-[var(--lt-surface-3)] text-[var(--lt-text-muted)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
