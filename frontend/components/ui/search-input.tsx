import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/utils/utils";
import { Input } from "@/components/ui/input";

export interface SearchInputProps
  extends Omit<React.ComponentProps<typeof Input>, "type"> {
  kbdHint?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, kbdHint, ...props }, ref) => (
    <div className={cn("relative w-full", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lt-text-subtle)]"
        aria-hidden="true"
      />
      <Input
        ref={ref}
        type="search"
        className={cn("pl-9", kbdHint && "pr-14")}
        {...props}
      />
      {kbdHint ? (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--lt-text-subtle)] sm:inline-block">
          {kbdHint}
        </kbd>
      ) : null}
    </div>
  )
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
