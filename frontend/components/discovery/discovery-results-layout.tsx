"use client";

import { useEffect, useState } from "react";
import { BusinessDetailsPanel } from "@/components/discovery/business-details-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/utils/utils";
import type { Lead } from "@/types/lead";
import { toast } from "@/components/ui/toast";

export interface DiscoveryResultsLayoutProps {
  children: React.ReactNode;
  activeLead: Lead | null;
  leadStatus?: string;
  onCloseDetails: () => void;
  onSaveLead?: (lead: Lead) => void;
  onAddToOutreach?: (lead: Lead) => void;
  onGenerateOutreach?: (lead: Lead) => void;
  className?: string;
}

export function DiscoveryResultsLayout({
  children,
  activeLead,
  leadStatus,
  onCloseDetails,
  onSaveLead,
  onAddToOutreach,
  onGenerateOutreach,
  className,
}: DiscoveryResultsLayoutProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setSheetOpen(Boolean(activeLead) && isMobile);
  }, [activeLead, isMobile]);

  function handleSave(lead: Lead) {
    onSaveLead?.(lead);
    toast.success("Lead saved");
  }

  if (isMobile) {
    return (
      <div className={cn("space-y-4", className)}>
        {children}
        <Dialog
          open={sheetOpen && !!activeLead}
          onOpenChange={(open) => {
            if (!open) {
              setSheetOpen(false);
              onCloseDetails();
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-lg">
            <DialogHeader className="sr-only">
              <DialogTitle>{activeLead?.business_name || "Business details"}</DialogTitle>
            </DialogHeader>
            <BusinessDetailsPanel
              lead={activeLead}
              status={leadStatus}
              onClose={() => {
                setSheetOpen(false);
                onCloseDetails();
              }}
              onSaveLead={handleSave}
              onAddToOutreach={onAddToOutreach}
              onGenerateOutreach={onGenerateOutreach}
              className="rounded-none border-0"
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px]",
        className
      )}
    >
      <div className="min-w-0">{children}</div>
      <div className="hidden min-h-[480px] xl:block">
        <div className="sticky top-[calc(var(--lt-header-height)+16px)] max-h-[calc(100vh-var(--lt-header-height)-32px)]">
          <BusinessDetailsPanel
            lead={activeLead}
            status={leadStatus}
            onClose={onCloseDetails}
            onSaveLead={handleSave}
            onAddToOutreach={onAddToOutreach}
            onGenerateOutreach={onGenerateOutreach}
            className="max-h-[calc(100vh-var(--lt-header-height)-32px)]"
          />
        </div>
      </div>
      {/* Tablet: overlay drawer when lead selected */}
      {activeLead && (
        <div className="fixed inset-y-0 right-0 z-40 w-[min(400px,100%)] border-l border-[var(--lt-border)] bg-[var(--lt-surface)] shadow-2xl xl:hidden">
          <BusinessDetailsPanel
            lead={activeLead}
            status={leadStatus}
            onClose={onCloseDetails}
            onSaveLead={handleSave}
            onAddToOutreach={onAddToOutreach}
            onGenerateOutreach={onGenerateOutreach}
            className="h-full rounded-none border-0"
          />
        </div>
      )}
    </div>
  );
}
