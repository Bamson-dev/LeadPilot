"use client";

import Link from "next/link";
import { AlertTriangle, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/utils/utils";
import type { OutreachMailbox } from "@/types/outreach";
import {
  accountTypeLabel,
  dailyUsagePercent,
  formatMailboxDate,
  mailboxHealth,
  mailboxHealthBadge,
  mailboxHealthLabel,
  mailboxStatusBadge,
  mailboxStatusLabel,
} from "@/lib/mailbox-display";

export interface MailboxDetailsPanelProps {
  mailbox: OutreachMailbox;
  disconnecting?: boolean;
  onClose?: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  className?: string;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-xs font-medium text-[var(--lt-text-subtle)]">{label}</dt>
      <dd className="min-w-0 text-sm text-[var(--lt-text)] sm:text-right">{children}</dd>
    </div>
  );
}

export function MailboxDetailsPanel({
  mailbox,
  disconnecting = false,
  onClose,
  onDisconnect,
  onReconnect,
  className,
}: MailboxDetailsPanelProps) {
  const health = mailboxHealth(mailbox);
  const usage = dailyUsagePercent(mailbox);
  const isPaused = mailbox.status === "paused_bounce";

  return (
    <Panel className={cn("flex h-full flex-col", className)}>
      <PanelHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <PanelTitle className="truncate text-base">{mailbox.email_address}</PanelTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge status={mailboxStatusBadge(mailbox.status)}>
              {mailboxStatusLabel(mailbox.status)}
            </StatusBadge>
            <StatusBadge status={mailboxHealthBadge(health)}>
              {mailboxHealthLabel(health)}
            </StatusBadge>
          </div>
        </div>
        {onClose ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </PanelHeader>

      <PanelContent className="flex-1 space-y-5 overflow-y-auto">
        {isPaused ? (
          <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <AlertTitle className="text-amber-100">Sending paused</AlertTitle>
            <AlertDescription className="text-amber-200/90">
              High bounce rate detected. Remove bad addresses from your lists, then disconnect
              and reconnect this mailbox to resume sending.
            </AlertDescription>
          </Alert>
        ) : null}

        {mailbox.last_error ? (
          <Alert variant="danger">
            <AlertTitle>Connection error</AlertTitle>
            <AlertDescription>{mailbox.last_error}</AlertDescription>
          </Alert>
        ) : null}

        <dl className="space-y-4">
          <DetailRow label="Account type">{accountTypeLabel(mailbox.account_type)}</DetailRow>
          <DetailRow label="Provider">Gmail (SMTP)</DetailRow>
          <DetailRow label="Last verified">
            {formatMailboxDate(mailbox.last_verified_at)}
          </DetailRow>
          <DetailRow label="Daily limit reset">
            {formatMailboxDate(mailbox.daily_count_reset_at)}
          </DetailRow>
        </dl>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--lt-text)]">Daily sends</span>
            <span className="text-[var(--lt-text-muted)]">
              {mailbox.daily_send_count.toLocaleString()} / {mailbox.daily_cap.toLocaleString()}
            </span>
          </div>
          <Progress
            value={usage}
            aria-label={`Daily send usage ${usage}%`}
            indicatorClassName={
              usage >= 90 ? "bg-[var(--lt-warning)]" : undefined
            }
          />
          <p className="text-xs text-[var(--lt-text-subtle)]">
            {mailbox.account_type === "workspace"
              ? "Workspace mailboxes have a higher daily cap."
              : "Personal Gmail mailboxes have a 300/day cap."}
          </p>
        </div>

        <p className="text-xs leading-relaxed text-[var(--lt-text-subtle)]">
          Connection is verified over SMTP when you connect or reconnect. There is no separate
          warm-up tracker — deliverability depends on list quality and Gmail limits.
        </p>

        <div className="flex flex-col gap-2 border-t border-[var(--lt-border)] pt-4">
          <Button type="button" variant="default" onClick={onReconnect}>
            <RefreshCw className="h-4 w-4" />
            {isPaused || mailbox.last_error ? "Verify & reconnect" : "Reconnect mailbox"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disconnecting}
            onClick={onDisconnect}
          >
            {disconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Disconnect
          </Button>
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/dashboard/outreach">Open Outreach</Link>
          </Button>
        </div>
      </PanelContent>
    </Panel>
  );
}
