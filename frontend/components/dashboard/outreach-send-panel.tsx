"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Lead } from "@/types/lead";
import type { OutreachEmailTemplate, OutreachMailbox, QueueSendResponse } from "@/types/outreach";
import { getVerifiedEmails, hasAnyEmail } from "@/utils/get-display-email";
import { applyBusinessNameMerge } from "@/lib/outreach-utils";
import { fetchEmailTemplates, queueOutreachSend } from "@/services/outreach-api";

interface OutreachSendPanelProps {
  open: boolean;
  selectedLeads: Lead[];
  mailboxes: OutreachMailbox[];
  sendBalance: number;
  hasMailbox: boolean;
  onClose: () => void;
  onSent: (result: QueueSendResponse) => void;
}

export function OutreachSendPanel({
  open,
  selectedLeads,
  mailboxes,
  sendBalance,
  hasMailbox,
  onClose,
  onSent,
}: OutreachSendPanelProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("Hi [Business Name],\n\n");
  const [templateId, setTemplateId] = useState("");
  const [templates, setTemplates] = useState<OutreachEmailTemplate[]>([]);
  const [sendMode, setSendMode] = useState<"auto" | "manual">("auto");
  const [mailboxId, setMailboxId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueueSendResponse | null>(null);

  const activeMailboxes = mailboxes.filter((m) => m.status === "active");

  const recipients = useMemo(() => {
    return selectedLeads
      .map((lead) => {
        const emails = getVerifiedEmails(lead);
        const email = emails[0]?.trim();
        if (!email) return null;
        return {
          lead,
          recipient_email: email,
          business_name: lead.business_name,
        };
      })
      .filter(Boolean) as Array<{
      lead: Lead;
      recipient_email: string;
      business_name: string;
    }>;
  }, [selectedLeads]);

  const previews = useMemo(() => {
    return recipients.map((r) => ({
      business_name: r.business_name,
      subject: applyBusinessNameMerge(subject, r.business_name),
      body: applyBusinessNameMerge(body, r.business_name),
      recipient_email: r.recipient_email,
    }));
  }, [recipients, subject, body]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
    void fetchEmailTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (sendMode === "manual" && !mailboxId && activeMailboxes[0]) {
      setMailboxId(activeMailboxes[0].id);
    }
  }, [open, sendMode, mailboxId, activeMailboxes]);

  if (!open) return null;

  const blockedNoMailbox = !hasMailbox;
  const blockedZeroBalance = sendBalance <= 0;
  const blockedFreeUsed =
    hasMailbox && sendBalance <= 0;

  async function handleSend() {
    setError(null);
    setResult(null);

    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required.");
      return;
    }
    if (recipients.length === 0) {
      setError("Select at least one lead with an email address.");
      return;
    }
    if (sendMode === "manual" && !mailboxId) {
      setError("Choose a mailbox for manual send.");
      return;
    }

    setSending(true);
    try {
      const response = await queueOutreachSend({
        targets: recipients.map((r) => ({
          recipient_email: r.recipient_email,
          business_name: r.business_name,
        })),
        subject: subject.trim(),
        body: body.trim(),
        template_id: templateId || undefined,
        mailbox_id: sendMode === "manual" ? mailboxId : undefined,
        send_mode: sendMode,
      });
      setResult(response);
      onSent(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/[0.1] bg-[#0F0F14] p-5 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#F4F4FF]">Send email to leads</h2>
            <p className="mt-1 text-sm text-[#6B6B80]">
              {recipients.length} recipient{recipients.length === 1 ? "" : "s"} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#6B6B80] hover:text-[#F4F4FF]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {blockedNoMailbox && (
          <div
            className="mt-4 rounded-lg px-4 py-3 text-sm"
            style={{
              background: "rgba(124,58,237,0.1)",
              border: "1px solid rgba(124,58,237,0.25)",
              color: "#E9D5FF",
            }}
          >
            Connect a Gmail mailbox in Email Outreach settings before you can send.
          </div>
        )}

        {blockedZeroBalance && hasMailbox && (
          <div
            className="mt-4 rounded-lg px-4 py-3 text-sm"
            style={{
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.25)",
              color: "#FCA5A5",
            }}
          >
            Your free sends are used and you have no send balance left.{" "}
            <Link href="/dashboard/plans" className="underline text-[#F4F4FF]">
              View plans
            </Link>{" "}
            to add more sends.
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">Template</label>
            <select
              value={templateId}
              onChange={(e) => {
                const id = e.target.value;
                setTemplateId(id);
                const tpl = templates.find((t) => t.id === id);
                if (tpl) {
                  setSubject(tpl.subject);
                  setBody(tpl.body);
                }
              }}
              disabled={sending || blockedNoMailbox || blockedFreeUsed}
              className="w-full rounded-md border border-white/10 bg-[#16161E] px-3 py-2 text-sm text-[#F4F4FF]"
            >
              <option value="">Custom message</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject line"
              disabled={sending || blockedNoMailbox || blockedFreeUsed}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
              Body (use [Business Name] for merge field)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              disabled={sending || blockedNoMailbox || blockedFreeUsed}
              className="w-full rounded-md border border-white/10 bg-[#16161E] px-3 py-2 text-sm text-[#F4F4FF] resize-y"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">Send mode</label>
              <select
                value={sendMode}
                onChange={(e) =>
                  setSendMode(e.target.value === "manual" ? "manual" : "auto")
                }
                disabled={sending || blockedNoMailbox || blockedFreeUsed}
                className="w-full rounded-md border border-white/10 bg-[#16161E] px-3 py-2 text-sm text-[#F4F4FF]"
              >
                <option value="auto">Auto — spread across mailboxes</option>
                <option value="manual">Manual — pick one mailbox</option>
              </select>
            </div>
            {sendMode === "manual" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">Mailbox</label>
                <select
                  value={mailboxId}
                  onChange={(e) => setMailboxId(e.target.value)}
                  disabled={sending || blockedNoMailbox || blockedFreeUsed}
                  className="w-full rounded-md border border-white/10 bg-[#16161E] px-3 py-2 text-sm text-[#F4F4FF]"
                >
                  {activeMailboxes.map((mb) => (
                    <option key={mb.id} value={mb.id}>
                      {mb.email_address}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {previews.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#16161E] p-4">
              <p className="text-xs font-semibold text-[#6B6B80] uppercase tracking-wide">
                Preview per recipient
              </p>
              <div className="mt-3 space-y-3 max-h-48 overflow-y-auto">
                {previews.map((p) => (
                  <div
                    key={p.recipient_email}
                    className="rounded-lg border border-white/[0.06] bg-[#0F0F14] p-3 text-xs"
                  >
                    <p className="text-[#A855F7] font-medium">{p.business_name}</p>
                    <p className="mt-1 text-[#6B6B80]">{p.recipient_email}</p>
                    <p className="mt-2 text-[#F4F4FF] font-semibold">{p.subject || "—"}</p>
                    <p className="mt-1 text-[#A1A1B5] whitespace-pre-wrap">{p.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-300">{error}</p>}

          {result && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.25)",
                color: "#A7F3D0",
              }}
            >
              <p>
                <strong>{result.queued}</strong> queued ·{" "}
                <strong>{result.skipped_suppression}</strong> skipped (suppressed) ·{" "}
                <strong>{result.short_credits}</strong> short (insufficient balance)
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
            Close
          </Button>
          <Button
            type="button"
            variant="glow"
            disabled={
              sending ||
              blockedNoMailbox ||
              blockedFreeUsed ||
              recipients.length === 0
            }
            onClick={() => void handleSend()}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Send email
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** @internal exported for tests */
export function leadHasSelectableEmail(lead: Lead): boolean {
  return hasAnyEmail(lead);
}
