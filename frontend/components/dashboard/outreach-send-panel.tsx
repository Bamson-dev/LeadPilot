"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Lead } from "@/types/lead";
import type { OutreachEmailTemplate, OutreachEmailTone, OutreachMailbox, QueueSendResponse } from "@/types/outreach";
import { hasAnyEmail } from "@/utils/get-display-email";
import { buildOutreachSendTargetsFromLeads } from "@leadthur/shared";
import { applyBusinessNameMerge } from "@/lib/outreach-utils";
import { fetchEmailTemplates, generateOutreachEmail, queueOutreachSend } from "@/services/outreach-api";
import type { OutreachFollowupStepInput } from "@/types/outreach";

const TONE_OPTIONS: Array<{ value: OutreachEmailTone | ""; label: string }> = [
  { value: "", label: "Default (direct)" },
  { value: "direct", label: "Direct" },
  { value: "friendly", label: "Friendly" },
  { value: "consultative", label: "Consultative" },
  { value: "bold", label: "Bold" },
];

export const OUTREACH_COMPOSE_PANEL_WIDTH = "28rem";

interface OutreachSendPanelProps {
  open: boolean;
  selectedLeads: Lead[];
  mailboxes: OutreachMailbox[];
  sendBalance: number;
  hasMailbox: boolean;
  targetBusinessType?: string;
  onClose: () => void;
  onSent: (result: QueueSendResponse) => void;
}

export function OutreachSendPanel({
  open,
  selectedLeads,
  mailboxes,
  sendBalance,
  hasMailbox,
  targetBusinessType = "",
  onClose,
  onSent,
}: OutreachSendPanelProps) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("Hi [Business Name],\n\n");
  const [templateId, setTemplateId] = useState("");
  const [templates, setTemplates] = useState<OutreachEmailTemplate[]>([]);
  const [serviceDescription, setServiceDescription] = useState("");
  const [businessType, setBusinessType] = useState(targetBusinessType);
  const [tone, setTone] = useState<OutreachEmailTone | "">("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<"auto" | "manual">("auto");
  const [mailboxId, setMailboxId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueueSendResponse | null>(null);
  const [followupsEnabled, setFollowupsEnabled] = useState(false);
  const [followupSteps, setFollowupSteps] = useState<OutreachFollowupStepInput[]>([
    { step_number: 1, gap_days: 3, subject: "Quick follow up for [Business Name]", body: "Hi [Business Name],\n\nJust following up on my last email.\n\nBest,\n" },
    { step_number: 2, gap_days: 3, subject: "Just checking in, [Business Name]", body: "Hi [Business Name],\n\nWanted to check if you had a chance to see my previous note.\n\nBest,\n" },
    { step_number: 3, gap_days: 4, subject: "Final follow up for [Business Name]", body: "Hi [Business Name],\n\nFinal quick nudge in case this is useful for your team.\n\nBest,\n" },
  ]);
  const [followupCount, setFollowupCount] = useState(0);
  const [followupError, setFollowupError] = useState<string | null>(null);

  const activeMailboxes = mailboxes.filter((m) => m.status === "active");

  const { recipients, sendableRecipients, skippedNoVerifiedPreview } = useMemo(() => {
    const { targets, skippedNoVerifiedPreview: skipped } =
      buildOutreachSendTargetsFromLeads(selectedLeads);
    const withLeads = targets.map((target) => {
      const lead =
        selectedLeads.find((l) => l.id === target.business_id) ??
        selectedLeads.find((l) => l.business_name === target.business_name);
      return { lead: lead ?? selectedLeads[0]!, ...target };
    });
    const sendableRecipients = withLeads.filter((r) => r.email_kind === "verified");
    return {
      recipients: withLeads,
      sendableRecipients,
      skippedNoVerifiedPreview: skipped,
    };
  }, [selectedLeads]);

  const firstPreview = useMemo(() => {
    const first = sendableRecipients[0];
    if (!first) return null;
    return {
      business_name: first.business_name,
      subject: applyBusinessNameMerge(subject, first.business_name),
      body: applyBusinessNameMerge(body, first.business_name),
    };
  }, [sendableRecipients, subject, body]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
    setGenerateError(null);
    setBusinessType(targetBusinessType);
    void fetchEmailTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [open, targetBusinessType]);

  useEffect(() => {
    if (!open) return;
    if (sendMode === "manual" && !mailboxId && activeMailboxes[0]) {
      setMailboxId(activeMailboxes[0].id);
    }
  }, [open, sendMode, mailboxId, activeMailboxes]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  const blockedZeroBalance = hasMailbox && sendBalance <= 0;
  const sendCount = sendableRecipients.length;
  const totalPotentialCredits =
    sendCount * (1 + (followupsEnabled ? Math.min(3, followupCount) : 0));
  const selectedMailbox =
    sendMode === "manual"
      ? activeMailboxes.find((m) => m.id === mailboxId) ?? activeMailboxes[0]
      : activeMailboxes[0];
  const showNewAccountWarning = followupsEnabled && (selectedMailbox?.daily_send_count ?? 0) < 20;
  const composeDisabled = sending || blockedZeroBalance || generating;

  async function handleGenerate() {
    setGenerateError(null);
    if (!serviceDescription.trim()) {
      setGenerateError("Describe your service first so the AI can write the email.");
      return;
    }
    if (!businessType.trim()) {
      setGenerateError("Add the type of business you are targeting.");
      return;
    }

    setGenerating(true);
    try {
      const generated = await generateOutreachEmail({
        service_description: serviceDescription.trim(),
        target_business_type: businessType.trim(),
        tone: tone || undefined,
      });
      setSubject(generated.subject);
      setBody(generated.body);
      setTemplateId("");
    } catch (err) {
      setGenerateError(
        err instanceof Error
          ? err.message
          : "Generation failed. Try again or write your email manually."
      );
    } finally {
      setGenerating(false);
    }
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
      setGenerateError(null);
    }
  }

  const mailboxLabel =
    activeMailboxes.length === 1
      ? activeMailboxes[0].email_address
      : sendMode === "auto"
        ? "Auto spread across mailboxes"
        : activeMailboxes.find((m) => m.id === mailboxId)?.email_address ?? "Pick a mailbox";

  async function handleSend() {
    setError(null);
    setResult(null);

    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required.");
      return;
    }
    if (sendableRecipients.length === 0) {
      if (skippedNoVerifiedPreview > 0) {
        setError(
          "No selected leads have a verified email. Predicted addresses are shown in results but cannot be sent automatically."
        );
      } else {
        setError("Select at least one lead with a verified email address.");
      }
      return;
    }
    if (sendMode === "manual" && !mailboxId) {
      setError("Choose a mailbox for manual send.");
      return;
    }
    if (followupsEnabled && followupCount > 3) {
      setFollowupError("You can set at most 3 follow ups.");
      return;
    }
    if (followupsEnabled) {
      for (let i = 0; i < followupCount; i++) {
        const step = followupSteps[i];
        if (!step) continue;
        if (step.gap_days < 2) {
          setFollowupError(`Follow up ${i + 1} gap must be at least 2 days.`);
          return;
        }
      }
    }

    setSending(true);
    try {
      const response = await queueOutreachSend({
        targets: recipients.map((r) => ({
          recipient_email: r.recipient_email,
          business_name: r.business_name,
          business_id: r.business_id,
          email_kind: r.email_kind,
        })),
        subject: subject.trim(),
        body: body.trim(),
        template_id: templateId || undefined,
        mailbox_id: sendMode === "manual" ? mailboxId : undefined,
        send_mode: sendMode,
        followups: {
          enabled: followupsEnabled && followupCount > 0,
          steps: followupSteps.slice(0, Math.min(3, followupCount)).map((step, idx) => ({
            ...step,
            step_number: idx + 1,
            gap_days: Math.max(2, step.gap_days),
          })),
        },
      });
      setResult(response);
      onSent(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  if (!mounted) return null;

  const panel = (
    <AnimatePresence>
      {open && (
        <>
          {isMobile && (
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black/60"
              onClick={onClose}
              aria-hidden
            />
          )}
          <motion.aside
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label="Compose outreach email"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
            className="fixed top-0 right-0 z-[201] flex h-full flex-col border-l border-white/[0.1] bg-[#0F0F14] shadow-2xl w-full sm:max-w-md lg:w-[28rem]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[#F4F4FF]">Compose email</h2>
                <p className="mt-1 text-sm text-[#6B6B80]">
                  {sendCount} verified email{sendCount === 1 ? "" : "s"} to send
                  {skippedNoVerifiedPreview > 0
                    ? ` · ${skippedNoVerifiedPreview} skipped (no verified email)`
                    : ""}
                </p>
                <p className="mt-1 truncate text-xs text-[#A855F7]">From: {mailboxLabel}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 text-[#6B6B80] hover:text-[#F4F4FF]"
                aria-label="Close compose panel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {activeMailboxes.length > 1 && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
                    Sending mailbox
                  </label>
                  <select
                    value={sendMode === "auto" ? "auto" : mailboxId}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "auto") {
                        setSendMode("auto");
                      } else {
                        setSendMode("manual");
                        setMailboxId(v);
                      }
                    }}
                    disabled={composeDisabled}
                    className="w-full rounded-md border border-white/10 bg-[#16161E] px-3 py-2 text-sm text-[#F4F4FF]"
                  >
                    <option value="auto">Auto spread across mailboxes</option>
                    {activeMailboxes.map((mb) => (
                      <option key={mb.id} value={mb.id}>
                        {mb.email_address}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rounded-xl border border-[#A855F7]/25 bg-[#16161E] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#A855F7]" />
                  <p className="text-sm font-semibold text-[#F4F4FF]">AI email writer</p>
                </div>
                <p className="text-xs text-[#6B6B80]">
                  Describe your offer and we&apos;ll draft a personalized cold email. You can edit
                  before sending.
                </p>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
                    Your service
                  </label>
                  <textarea
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    rows={3}
                    disabled={composeDisabled}
                    placeholder="e.g. I build fast mobile-friendly websites for local restaurants"
                    className="w-full rounded-md border border-white/10 bg-[#0F0F14] px-3 py-2 text-sm text-[#F4F4FF] resize-y"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
                    Target business type
                  </label>
                  <Input
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    placeholder="e.g. restaurants, salons, gyms"
                    disabled={composeDisabled}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
                    Tone (optional)
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as OutreachEmailTone | "")}
                    disabled={composeDisabled}
                    className="w-full rounded-md border border-white/10 bg-[#0F0F14] px-3 py-2 text-sm text-[#F4F4FF]"
                  >
                    {TONE_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-[#A855F7]/40 text-[#E9D5FF] hover:bg-[#A855F7]/10"
                  disabled={composeDisabled}
                  onClick={() => void handleGenerate()}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Generate email
                    </>
                  )}
                </Button>
                {generateError && (
                  <p className="text-xs text-red-300">{generateError}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
                  Quick template
                </label>
                <select
                  value={templateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  disabled={composeDisabled}
                  className="w-full rounded-md border border-white/10 bg-[#16161E] px-3 py-2 text-sm text-[#F4F4FF]"
                >
                  <option value="">Choose a template</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
                  Follow up sequence
                </label>
                <div className="rounded-xl border border-white/[0.08] bg-[#16161E] p-3 space-y-3">
                  <label className="flex items-center justify-between text-sm text-[#F4F4FF]">
                    <span>Enable follow ups for this batch</span>
                    <input
                      type="checkbox"
                      checked={followupsEnabled}
                      onChange={(e) => {
                        setFollowupsEnabled(e.target.checked);
                        setFollowupError(null);
                      }}
                      disabled={composeDisabled}
                    />
                  </label>
                  <p className="text-xs text-[#6B6B80]">
                    Toggle is off by default. Each follow up is a real send and spends one credit per lead.
                  </p>
                  {followupsEnabled && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="text-xs text-[#A1A1B5]">
                          Number of follow ups (0-3)
                          <input
                            type="number"
                            min={0}
                            max={3}
                            value={followupCount}
                            onChange={(e) => {
                              const next = Math.min(3, Math.max(0, Number(e.target.value) || 0));
                              setFollowupCount(next);
                              setFollowupError(null);
                            }}
                            className="mt-1 w-full rounded-md border border-white/10 bg-[#0F0F14] px-2 py-1 text-sm text-[#F4F4FF]"
                          />
                        </label>
                      </div>
                      <p className="text-xs text-[#A1A1B5]">
                        Potential credit spend: up to{" "}
                        <strong className="text-[#F4F4FF]">{totalPotentialCredits}</strong> (for {sendCount} lead
                        {sendCount === 1 ? "" : "s"} across {1 + followupCount} total touches).
                      </p>
                      {showNewAccountWarning && (
                        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                          This mailbox is still new in LeadThur. Sending many cold emails too quickly can get it flagged.
                          Start with a smaller batch first.
                        </p>
                      )}
                      {Array.from({ length: followupCount }).map((_, idx) => {
                        const step = followupSteps[idx]!;
                        return (
                          <div key={idx} className="rounded-lg border border-white/10 bg-[#0F0F14] p-3 space-y-2">
                            <p className="text-xs font-semibold text-[#F4F4FF]">Follow up {idx + 1}</p>
                            <label className="text-xs text-[#A1A1B5] block">
                              Gap (days, minimum 2)
                              <input
                                type="number"
                                min={2}
                                value={step.gap_days}
                                onChange={(e) => {
                                  const raw = Number(e.target.value) || 0;
                                  const value = Math.max(2, raw);
                                  setFollowupSteps((prev) =>
                                    prev.map((item, sidx) =>
                                      sidx === idx ? { ...item, gap_days: value } : item
                                    )
                                  );
                                  if (raw < 2) {
                                    setFollowupError(`Follow up ${idx + 1} was clamped to 2 days.`);
                                  } else {
                                    setFollowupError(null);
                                  }
                                }}
                                className="mt-1 w-full rounded-md border border-white/10 bg-[#16161E] px-2 py-1 text-sm text-[#F4F4FF]"
                              />
                            </label>
                            <label className="text-xs text-[#A1A1B5] block">
                              Subject
                              <input
                                type="text"
                                value={step.subject}
                                onChange={(e) =>
                                  setFollowupSteps((prev) =>
                                    prev.map((item, sidx) =>
                                      sidx === idx ? { ...item, subject: e.target.value } : item
                                    )
                                  )
                                }
                                className="mt-1 w-full rounded-md border border-white/10 bg-[#16161E] px-2 py-1 text-sm text-[#F4F4FF]"
                              />
                            </label>
                            <label className="text-xs text-[#A1A1B5] block">
                              Body
                              <textarea
                                value={step.body}
                                onChange={(e) =>
                                  setFollowupSteps((prev) =>
                                    prev.map((item, sidx) =>
                                      sidx === idx ? { ...item, body: e.target.value } : item
                                    )
                                  )
                                }
                                rows={3}
                                className="mt-1 w-full rounded-md border border-white/10 bg-[#16161E] px-2 py-1 text-sm text-[#F4F4FF]"
                              />
                            </label>
                          </div>
                        );
                      })}
                      {followupError && <p className="text-xs text-amber-300">{followupError}</p>}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
                  Subject
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line"
                  disabled={composeDisabled}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
                  Body
                </label>
                <p className="mb-2 text-xs text-[#6B6B80] leading-relaxed">
                  Use{" "}
                  <code className="rounded bg-[#16161E] px-1.5 py-0.5 text-[#F4F4FF]">
                    [Business Name]
                  </code>{" "}
                  — it fills with each lead&apos;s business name when sent.
                </p>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  disabled={composeDisabled}
                  className="min-h-[280px] w-full rounded-md border border-white/10 bg-[#16161E] px-3 py-2 text-sm text-[#F4F4FF] resize-y"
                />
              </div>

              {firstPreview && (
                <div className="rounded-xl border border-white/[0.08] bg-[#16161E] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6B80]">
                    Preview (first recipient)
                  </p>
                  <p className="mt-2 text-xs text-[#A855F7] font-medium">
                    {firstPreview.business_name}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#F4F4FF]">
                    {firstPreview.subject || "—"}
                  </p>
                  <p className="mt-2 text-xs text-[#A1A1B5] whitespace-pre-wrap">
                    {firstPreview.body}
                  </p>
                </div>
              )}

              {blockedZeroBalance && (
                <div
                  className="rounded-lg px-4 py-3 text-sm"
                  style={{
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.25)",
                    color: "#FCA5A5",
                  }}
                >
                  Your free sends and credits are used up.{" "}
                  <Link href="/dashboard/plans" className="underline text-[#F4F4FF]">
                    View plans
                  </Link>{" "}
                  to add more sends.
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
                  <p className="font-semibold text-[#F4F4FF]">Send summary</p>
                  <p className="mt-2">
                    <strong>{result.queued}</strong> queued ·{" "}
                    <strong>{result.skipped_suppression}</strong> skipped (suppressed) ·{" "}
                    <strong>{result.short_credits}</strong> short (insufficient balance)
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.08] px-5 py-4">
              <Button
                type="button"
                variant="glow"
                className="w-full"
                disabled={
                  sending ||
                  generating ||
                  blockedZeroBalance ||
                  sendCount === 0 ||
                  !hasMailbox
                }
                onClick={() => void handleSend()}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send {sendCount} email{sendCount === 1 ? "" : "s"}
                  </>
                )}
              </Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(panel, document.body);
}

/** @internal exported for tests */
export function leadHasSelectableEmail(lead: Lead): boolean {
  return hasAnyEmail(lead);
}

/** @internal exported for tests */
export function buildSendPayload(input: {
  recipients: Array<{
    recipient_email: string;
    business_name: string;
    business_id?: string;
    email_kind?: "verified" | "predicted";
  }>;
  subject: string;
  body: string;
  templateId: string;
  sendMode: "auto" | "manual";
  mailboxId: string;
}) {
  return {
    targets: input.recipients.map((r) => ({
      recipient_email: r.recipient_email,
      business_name: r.business_name,
      business_id: r.business_id,
      email_kind: r.email_kind,
    })),
    subject: input.subject.trim(),
    body: input.body.trim(),
    template_id: input.templateId || undefined,
    mailbox_id: input.sendMode === "manual" ? input.mailboxId : undefined,
    send_mode: input.sendMode,
  };
}
