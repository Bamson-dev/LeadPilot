import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lt-cyan)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lt-bg)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--lt-accent)] text-white hover:bg-[var(--lt-accent-hover)]",
        cyan:
          "bg-[var(--lt-cyan)] text-[var(--lt-bg)] hover:bg-[var(--lt-cyan)]/90",
        soft:
          "bg-[var(--lt-accent-soft)] text-[var(--lt-bg)] hover:bg-[var(--lt-accent-soft)]/90",
        outline:
          "border border-[var(--lt-border)] bg-transparent text-[var(--lt-text)] hover:bg-[var(--lt-surface-3)] hover:border-[var(--lt-border-strong)]",
        ghost:
          "text-[var(--lt-text-muted)] hover:text-[var(--lt-text)] hover:bg-[var(--lt-surface-3)]",
        destructive:
          "bg-[var(--lt-danger)] text-white hover:bg-[var(--lt-danger)]/90",
        success:
          "bg-[var(--lt-success)] text-white hover:bg-[var(--lt-success)]/90",
        /** @deprecated Use `default` — kept for legacy consumers during V2 migration */
        glow:
          "bg-[var(--lt-accent)] text-white hover:bg-[var(--lt-accent-hover)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
