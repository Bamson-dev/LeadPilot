"use client";

import { Filter, Download, Bookmark } from "lucide-react";
import { cn } from "@/utils/utils";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";

export interface DiscoveryWorkspaceHeaderProps {
  title: string;
  subtitle?: string;
  filterQuery?: string;
  onFilterQueryChange?: (value: string) => void;
  onFiltersClick?: () => void;
  onSaveClick?: () => void;
  onExportClick?: () => void;
  exportDisabled?: boolean;
  className?: string;
}

export function DiscoveryWorkspaceHeader({
  title,
  subtitle,
  filterQuery = "",
  onFilterQueryChange,
  onFiltersClick,
  onSaveClick,
  onExportClick,
  exportDisabled,
  className,
}: DiscoveryWorkspaceHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-[var(--lt-border)] pb-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight text-[var(--lt-text)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--lt-text-muted)]">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onFilterQueryChange ? (
          <SearchInput
            value={filterQuery}
            onChange={(e) => onFilterQueryChange(e.target.value)}
            placeholder="Search leads, companies…"
            className="w-full sm:w-56"
            aria-label="Filter results"
          />
        ) : null}
        {onFiltersClick ? (
          <Button type="button" variant="outline" size="sm" onClick={onFiltersClick}>
            <Filter className="h-3.5 w-3.5" />
            Filters
          </Button>
        ) : null}
        {onSaveClick ? (
          <Button type="button" variant="outline" size="sm" onClick={onSaveClick}>
            <Bookmark className="h-3.5 w-3.5" />
            Save
          </Button>
        ) : null}
        {onExportClick ? (
          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={onExportClick}
            disabled={exportDisabled}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        ) : null}
      </div>
    </div>
  );
}
