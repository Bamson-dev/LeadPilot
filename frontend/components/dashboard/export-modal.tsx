"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2 } from "lucide-react";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onDownload: () => void;
}

export function ExportModal({
  open,
  onOpenChange,
  count,
  onDownload,
}: ExportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
          </div>
          <DialogTitle className="text-center">Export Ready</DialogTitle>
          <DialogDescription className="text-center">
            Successfully prepared {count} lead{count !== 1 ? "s" : ""} for download.
          </DialogDescription>
        </DialogHeader>
        <Button variant="glow" className="w-full" onClick={onDownload}>
          <Download className="h-4 w-4" />
          Download CSV
        </Button>
      </DialogContent>
    </Dialog>
  );
}
