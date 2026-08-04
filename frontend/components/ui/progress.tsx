"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/utils/utils";

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorClassName, ...props }, ref) => {
  const progressValue = value ?? 0;

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={progressValue}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-[var(--lt-surface-3)]",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-[var(--lt-cyan)] to-[var(--lt-accent)] transition-all duration-500 ease-out",
          indicatorClassName
        )}
        style={{ width: `${progressValue}%` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
