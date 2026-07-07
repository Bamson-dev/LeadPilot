"use client";

import { useState } from "react";
import { Loader2, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OutreachMailbox } from "@/types/outreach";
import { connectMailbox, disconnectMailbox } from "@/services/outreach-api";
import { isValidAppPassword, normalizeAppPassword } from "@/lib/outreach-utils";

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
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "workspace">("personal");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const activeMailboxes = mailboxes.filter((m) => m.status === "active");
  const pausedMailboxes = mailboxes.filter((m) => m.status === "paused_bounce");

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnectError(null);
    setPasswordError(null);

    const normalized = normalizeAppPassword(appPassword);
    if (!isValidAppPassword(normalized)) {
      setPasswordError("App password must be exactly 16 characters with no spaces.");
      return;
    }

    setConnecting(true);
    try {
      await connectMailbox({
        email_address: email.trim(),
        app_password: normalized,
        account_type: accountType,
      });
      setOpen(false);
      setEmail("");
      setAppPassword("");
      setAccountType("personal");
      onChanged();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Failed to connect mailbox");
    } finally {
      setConnecting(false);
    }
  }

  async function handleRemove(mailboxId: string) {
    setRemovingId(mailboxId);
    try {
      await disconnectMailbox(mailboxId);
      onChanged();
    } catch {
      /* parent refresh may still help */
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
        </div>
        <Button
          type="button"
          variant="glow"
          onClick={() => {
            setOpen((v) => !v);
            setConnectError(null);
            setPasswordError(null);
          }}
          disabled={activeMailboxes.length >= maxMailboxes && !open}
        >
          <Mail className="h-4 w-4" />
          {open ? "Cancel" : "Connect Gmail"}
        </Button>
      </div>

      {open && (
        <form
          onSubmit={(e) => void handleConnect(e)}
          className="mt-5 rounded-xl border border-white/[0.08] bg-[#0F0F14] p-4 space-y-4"
        >
          <div className="rounded-lg bg-[#16161E] p-3 text-xs text-[#A1A1B5] leading-relaxed">
            <p className="font-semibold text-[#F4F4FF] mb-2">How to get a Gmail app password</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Turn on 2-Step Verification in your Google Account.</li>
              <li>Go to your Google Account App Passwords page.</li>
              <li>Generate a password for Mail and copy the 16 characters.</li>
              <li>Paste the 16 characters here (no spaces).</li>
            </ol>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
              Gmail address
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              required
              disabled={connecting}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
              App password
            </label>
            <Input
              type="password"
              value={appPassword}
              onChange={(e) => {
                setAppPassword(e.target.value);
                setPasswordError(null);
              }}
              placeholder="16-character app password"
              required
              disabled={connecting}
              autoComplete="off"
            />
            {passwordError && (
              <p className="mt-1.5 text-xs text-red-400">{passwordError}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
              Account type
            </label>
            <select
              value={accountType}
              onChange={(e) =>
                setAccountType(e.target.value === "workspace" ? "workspace" : "personal")
              }
              disabled={connecting}
              className="w-full rounded-md border border-white/10 bg-[#16161E] px-3 py-2 text-sm text-[#F4F4FF]"
            >
              <option value="personal">Personal Gmail</option>
              <option value="workspace">Google Workspace</option>
            </select>
          </div>

          {connectError && (
            <p className="text-sm text-red-300 whitespace-pre-wrap">{connectError}</p>
          )}

          <Button type="submit" variant="glow" disabled={connecting} className="w-full sm:w-auto">
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
              </>
            ) : (
              "Connect mailbox"
            )}
          </Button>
        </form>
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
