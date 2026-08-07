"use client";

import * as React from "react";
import { Toaster as Sonner, toast } from "sonner";
import { cn } from "@/utils/utils";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ className, ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className={cn("toaster group", className)}
      toastOptions={{
        classNames: {
          toast: cn(
            "group toast rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)] text-[var(--lt-text)] shadow-lg"
          ),
          title: "text-[var(--lt-text)] text-sm font-medium",
          description: "text-[var(--lt-text-muted)] text-sm",
          actionButton:
            "bg-[var(--lt-accent)] text-white text-xs font-medium rounded-md px-3 py-1.5",
          cancelButton:
            "bg-[var(--lt-surface-3)] text-[var(--lt-text-muted)] text-xs font-medium rounded-md px-3 py-1.5",
          closeButton:
            "bg-[var(--lt-surface-3)] border-[var(--lt-border)] text-[var(--lt-text-muted)] hover:text-[var(--lt-text)]",
          success:
            "border-[var(--lt-success)]/30 bg-[var(--lt-success-soft)] text-[var(--lt-success)]",
          error:
            "border-[var(--lt-danger)]/30 bg-[var(--lt-danger-soft)] text-[var(--lt-danger)]",
          warning:
            "border-[var(--lt-warning)]/30 bg-[var(--lt-warning-soft)] text-[var(--lt-warning)]",
          info: "border-[var(--lt-cyan)]/30 bg-[var(--lt-cyan-soft)] text-[var(--lt-cyan)]",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
