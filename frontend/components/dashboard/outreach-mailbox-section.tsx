"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OutreachMailbox } from "@/types/outreach";
import { disconnectMailbox } from "@/services/outreach-api";
import { OutreachGuidedMailboxConnect } from "@/components/dashboard/outreach-guided-mailbox-connect";

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
    <div className="glass rounded-2xl p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#F4F4FF]">Gmail mailboxes</h2>
          <p className="mt-1 text-sm text-[#6B6B80]">
            Connect Gmail to send outreach from your own address ({activeMailboxes.length}/
            {maxMailboxes} connected).
          </p>
          <p className="mt-1 text-xs text-[#8888A8]">
            Need more sends?{" "}
            <Link href="/dashboard/plans" className="text-[#A855F7] underline">
              Open outreach billing
            </Link>
          </p>
        </div>
        <Button
          type="button"
          variant="glow"
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
          <div
            key={mailbox.id}
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
          >
            <p className="font-semibold text-[#F4F4FF]">{mailbox.email_address}</p>
            <p className="mt-1 text-sm text-amber-200">
              Sending paused — high bounce rate detected on this mailbox.
            </p>
            {mailbox.last_error && (
              <p className="mt-2 text-xs text-amber-100/90">{mailbox.last_error}</p>
            )}
            <p className="mt-2 text-xs text-[#8888A8]">
              Remove bad addresses from your list, then disconnect and reconnect this mailbox to
              resume sending.
            </p>
          </div>
        ))}

        {activeMailboxes.length === 0 && pausedMailboxes.length === 0 ? (
          <p className="text-sm text-[#6B6B80]">
            No Gmail mailbox connected yet. Connect one to unlock your free sends and start
            emailing leads.
          </p>
        ) : (
          activeMailboxes.map((mailbox) => (
            <div
              key={mailbox.id}
              className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#0F0F14] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-[#F4F4FF]">{mailbox.email_address}</p>
                <p className="mt-1 text-xs text-[#6B6B80] capitalize">
                  {mailbox.account_type} · Daily sends {mailbox.daily_send_count}/
                  {mailbox.daily_cap}
                </p>
                {mailbox.last_error && (
                  <p className="mt-1 text-xs text-red-400">{mailbox.last_error}</p>
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
