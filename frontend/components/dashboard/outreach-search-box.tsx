"use client";

import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="rounded-xl border border-white/[0.08] bg-[#0F0F14]/60 p-3 sm:p-4">
      <div
        className="gap-3"
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 10 : 12,
        }}
      >
        <div className={isMobile ? "w-full" : "flex-1 min-w-0"}>
          <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
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
        <div className={isMobile ? "w-full" : "flex-1 min-w-0"}>
          <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
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
          className={isMobile ? "w-full" : "flex shrink-0 items-end"}
          style={isMobile ? undefined : { paddingBottom: 1 }}
        >
          <Button
            type="button"
            variant="glow"
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
