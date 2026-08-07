import * as React from "react";
import { cn } from "@/utils/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-24 w-full rounded-md border border-[var(--lt-border)] bg-[var(--lt-surface-3)] px-3 py-2 text-sm text-[var(--lt-text)] placeholder:text-[var(--lt-text-subtle)] transition-colors duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lt-cyan)]/50 focus-visible:border-[var(--lt-cyan)]/40",
      "hover:border-[var(--lt-border-strong)] disabled:cursor-not-allowed disabled:opacity-50 resize-y",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
