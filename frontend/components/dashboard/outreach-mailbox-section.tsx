"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { OutreachMailbox } from "@/types/outreach";
import { disconnectMailbox } from "@/services/outreach-api";
import { OutreachGuidedMailboxConnect } from "@/components/dashboard/outreach-guided-mailbox-connect";
import {
  accountTypeLabel,
  mailboxStatusBadge,
  mailboxStatusLabel,
} from "@/lib/mailbox-display";

interface OutreachMailboxSectionProps {
  mailboxes: OutreachMailbox[];
  maxMailboxes: number;
  onChanged: () => void;
}

export function OutreachMailboxSection({
  mailboxes,
  maxMailboxes,
  onChanged,
}: OutreachMailboxSectionProps) {
  const [open, setOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const activeMailboxes = mailboxes.filter((m) => m.status === "active");
  const pausedMailboxes = mailboxes.filter((m) => m.status === "paused_bounce");

  async function handleRemove(mailboxId: string) {
    setRemovingId(mailboxId);
    try {
      await disconnectMailbox(mailboxId);
      onChanged();
    } catch {
      onChanged();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--lt-text)]">Gmail mailboxes</h2>
          <p className="mt-1 text-sm text-[var(--lt-text-muted)]">
            Connect Gmail to send outreach from your own address ({activeMailboxes.length}/
            {maxMailboxes} connected).
          </p>
          <p className="mt-1 text-xs text-[var(--lt-text-subtle)]">
            Need more sends?{" "}
            <Link href="/dashboard/plans" className="text-[var(--lt-accent-soft)] underline">
              Open outreach billing
            </Link>
            {" · "}
            <Link href="/dashboard/mailboxes" className="text-[var(--lt-accent-soft)] underline">
              Full mailbox workspace
            </Link>
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          onClick={() => setOpen((v) => !v)}
          disabled={activeMailboxes.length >= maxMailboxes && !open}
        >
          <Mail className="h-4 w-4" />
          {open ? "Cancel" : "Connect Gmail"}
        </Button>
      </div>

      {open && (
        <OutreachGuidedMailboxConnect
          onConnected={() => {
            setOpen(false);
            onChanged();
          }}
          onCancel={() => setOpen(false)}
        />
      )}

      <div className="mt-5 space-y-3">
        {pausedMailboxes.map((mailbox) => (
          <Alert
            key={mailbox.id}
            variant="warning"
            className="border-[var(--lt-warning)]/30 bg-[var(--lt-warning-soft)]"
          >
            <AlertTitle className="flex flex-wrap items-center gap-2">
              {mailbox.email_address}
              <StatusBadge status={mailboxStatusBadge(mailbox.status)}>
                {mailboxStatusLabel(mailbox.status)}
              </StatusBadge>
            </AlertTitle>
            <AlertDescription>
              Sending paused — high bounce rate detected on this mailbox.
              {mailbox.last_error ? (
                <span className="mt-1 block">{mailbox.last_error}</span>
              ) : null}
              <span className="mt-2 block text-[var(--lt-text-subtle)]">
                Remove bad addresses from your list, then disconnect and reconnect this mailbox to
                resume sending.
              </span>
            </AlertDescription>
          </Alert>
        ))}

        {activeMailboxes.length === 0 && pausedMailboxes.length === 0 ? (
          <p className="text-sm text-[var(--lt-text-muted)]">
            No Gmail mailbox connected yet. Connect one to unlock your free sends and start
            emailing leads.
          </p>
        ) : (
          activeMailboxes.map((mailbox) => (
            <div
              key={mailbox.id}
              className="flex flex-col gap-3 rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--lt-text)]">{mailbox.email_address}</p>
                  <StatusBadge status={mailboxStatusBadge(mailbox.status)}>
                    {mailboxStatusLabel(mailbox.status)}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-[var(--lt-text-muted)]">
                  {accountTypeLabel(mailbox.account_type)} · Daily sends{" "}
                  {mailbox.daily_send_count}/{mailbox.daily_cap}
                </p>
                {mailbox.last_error && (
                  <p className="mt-1 text-xs text-[var(--lt-danger)]">{mailbox.last_error}</p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={removingId === mailbox.id}
                onClick={() => void handleRemove(mailbox.id)}
              >
                {removingId === mailbox.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Remove
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
