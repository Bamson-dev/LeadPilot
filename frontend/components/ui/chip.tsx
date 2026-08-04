import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/utils";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  onRemove?: () => void;
  removeLabel?: string;
}

const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, children, onRemove, removeLabel = "Remove", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-[var(--lt-border)] bg-[var(--lt-surface-3)] px-2 py-1 text-xs font-medium text-[var(--lt-text)]",
        className
      )}
      {...props}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded-sm text-[var(--lt-text-subtle)] transition-colors",
            "hover:bg-[var(--lt-surface-2)] hover:text-[var(--lt-text)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lt-cyan)]/50"
          )}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  )
);
Chip.displayName = "Chip";

export { Chip };
