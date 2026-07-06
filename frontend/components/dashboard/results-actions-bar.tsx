"use client";

import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResultsActionsBarProps {
  exportCount: number;
  onDownload: () => void;
  onClear: () => void;
  showClear?: boolean;
  exportPulse?: boolean;
  isMobile?: boolean;
}

export function ResultsActionsBar({
  exportCount,
  onDownload,
  onClear,
  showClear = true,
  exportPulse = false,
  isMobile = false,
}: ResultsActionsBarProps) {
  if (exportCount === 0 && !showClear) return null;

  return (
    <div
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
      data-results-actions
    >
      <Button
        type="button"
        variant="outline"
        onClick={onDownload}
        disabled={exportCount === 0}
        className={[
          isMobile ? "w-full" : "",
          exportPulse ? "export-pulse-btn" : "",
        ].join(" ")}
      >
        <Download className="h-4 w-4" />
        Download {exportCount > 0 ? exportCount : ""} Leads
      </Button>
      {showClear && exportCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          onClick={onClear}
          className={isMobile ? "w-full" : ""}
        >
          <Trash2 className="h-4 w-4" /> Clear Results
        </Button>
      )}
    </div>
  );
}
