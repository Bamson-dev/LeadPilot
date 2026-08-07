import * as React from "react";
import { cn } from "@/utils/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-[var(--lt-border)] bg-[var(--lt-surface-3)] px-3 py-2 text-sm text-[var(--lt-text)] placeholder:text-[var(--lt-text-subtle)] transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lt-cyan)]/50 focus-visible:border-[var(--lt-cyan)]/40",
        "hover:border-[var(--lt-border-strong)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
