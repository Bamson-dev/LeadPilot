"use client";

import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/utils";

interface OutreachSearchBoxProps {
  businessType: string;
  location: string;
  onBusinessTypeChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onSearch: () => void;
  disabled?: boolean;
  isMobile?: boolean;
}

export function OutreachSearchBox({
  businessType,
  location,
  onBusinessTypeChange,
  onLocationChange,
  onSearch,
  disabled = false,
  isMobile = false,
}: OutreachSearchBoxProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") onSearch();
  }

  return (
    <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-3 sm:p-4">
      <div
        className={cn("gap-3", isMobile ? "flex flex-col gap-2.5" : "flex flex-row gap-3")}
      >
        <div className={isMobile ? "w-full" : "min-w-0 flex-1"}>
          <label className="mb-1.5 block text-xs font-medium text-[var(--lt-text-subtle)]">
            Business type
          </label>
          <Input
            placeholder="e.g. restaurants, dentists, gyms"
            value={businessType}
            onChange={(e) => onBusinessTypeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="w-full"
          />
        </div>
        <div className={isMobile ? "w-full" : "min-w-0 flex-1"}>
          <label className="mb-1.5 block text-xs font-medium text-[var(--lt-text-subtle)]">
            Location
          </label>
          <Input
            placeholder="e.g. Lagos Nigeria, London UK"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="w-full"
          />
        </div>
        <div
          className={cn(
            isMobile ? "w-full" : "flex shrink-0 items-end pb-px"
          )}
        >
          <Button
            type="button"
            variant="default"
            onClick={onSearch}
            disabled={disabled}
            className={isMobile ? "w-full" : "whitespace-nowrap"}
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
        </div>
      </div>
    </div>
  );
}
