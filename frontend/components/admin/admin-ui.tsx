"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/status-badge";
import { cn } from "@/utils/utils";

export const adminSectionClass =
  "mx-auto mt-8 max-w-6xl overflow-hidden rounded-2xl border border-[var(--lt-border)] bg-[var(--lt-surface)]";

export const adminSectionBodyClass = "p-4 sm:p-6";

export const adminTableClass = "w-full border-collapse text-sm";

export const adminTableHeadRowClass =
  "border-b border-[var(--lt-border)] text-left text-xs uppercase tracking-wide text-[var(--lt-text-subtle)]";

export const adminTableRowClass = "border-b border-[var(--lt-border)]";

export const adminLabelClass = "text-xs font-medium text-[var(--lt-text-muted)]";

export const adminMutedClass = "text-sm text-[var(--lt-text-muted)]";

export const adminErrorClass = "text-sm text-[var(--lt-danger)]";

export function AdminSection({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn(adminSectionClass, className)}>
      {children}
    </section>
  );
}

export function AdminSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--lt-border)] px-4 py-3.5 sm:px-6">
      <div>
        <h3 className="m-0 text-sm font-bold text-[var(--lt-text)]">{title}</h3>
        {description ? (
          <p className="m-0 mt-0.5 text-xs text-[var(--lt-text-subtle)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function AdminPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn("mt-8", className)}>
      <PanelHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-[var(--lt-border)] pb-4">
        <div>
          <PanelTitle className="text-base">{title}</PanelTitle>
          {description ? <p className="mt-1 text-sm text-[var(--lt-text-muted)]">{description}</p> : null}
        </div>
        {action}
      </PanelHeader>
      <PanelContent className="p-4 sm:p-6">{children}</PanelContent>
    </Panel>
  );
}

export function AdminChipButton({
  active,
  children,
  onClick,
  type = "button",
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <Button
      type={type}
      size="sm"
      variant={active ? "default" : "outline"}
      className="h-8 text-xs"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function AdminLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-6">
      <Skeleton className="h-4 w-4 rounded-full" />
      <p className={adminMutedClass}>{label}</p>
    </div>
  );
}

export function AdminConvertedBadge({ converted }: { converted: boolean }) {
  return (
    <StatusBadge
      status={(converted ? "active" : "replied") as StatusBadgeStatus}
      label={converted ? "Converted" : "Active"}
    />
  );
}

export function rateStatusClass(rate: number | null): string {
  if (rate === null) return "text-[var(--lt-text-subtle)]";
  if (rate > 40) return "text-[var(--lt-success)]";
  if (rate >= 20) return "text-[var(--lt-warning)]";
  return "text-[var(--lt-danger)]";
}

export function AdminToast({
  type,
  text,
}: {
  type: "success" | "error";
  text: string;
}) {
  return (
    <div
      className={cn(
        "fixed right-4 top-4 z-[1000] rounded-lg px-3.5 py-3 text-sm font-semibold text-white shadow-lg",
        type === "success" ? "bg-[var(--lt-success)]" : "bg-[var(--lt-danger)]"
      )}
      role="status"
    >
      {text}
    </div>
  );
}

export function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
      <Panel className="w-full max-w-md">
        <PanelContent className="space-y-4 p-5">
          <h3 className="m-0 text-base font-extrabold text-[var(--lt-text)]">{title}</h3>
          <p className="m-0 text-sm leading-relaxed text-[var(--lt-text-muted)]">{description}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
