"use client";

import { Download, Send, X } from "lucide-react";
import { cn } from "@/utils/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export interface DiscoveryBulkBarProps {
  selectedCount: number;
  onClear: () => void;
  onExport?: () => void;
  onOutreach?: () => void;
  className?: string;
}

export function DiscoveryBulkBar({
  selectedCount,
  onClear,
  onExport,
  onOutreach,
  className,
}: DiscoveryBulkBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-3 py-2",
        className
      )}
      role="region"
      aria-label="Bulk actions"
    >
      <div className="flex items-center gap-2 text-sm text-[var(--lt-text)]">
        <Checkbox checked onCheckedChange={() => onClear()} aria-label="Clear selection" />
        <span className="tabular-nums font-medium">{selectedCount} selected</span>
        <button
          type="button"
          onClick={onClear}
          className="text-[var(--lt-text-muted)] hover:text-[var(--lt-text)]"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onOutreach ? (
          <Button type="button" variant="default" size="sm" onClick={onOutreach}>
            <Send className="h-3.5 w-3.5" />
            Add to Outreach
          </Button>
        ) : null}
        {onExport ? (
          <Button type="button" variant="outline" size="sm" onClick={onExport}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        ) : null}
      </div>
    </div>
  );
}
