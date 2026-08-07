"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getBroadcastCount,
  getBroadcastHistory,
  sendTrialBroadcast,
  type BroadcastHistoryRow,
} from "@/services/admin-api";
import {
  AdminConfirmDialog,
  AdminLoading,
  AdminPanel,
  AdminToast,
  adminLabelClass,
  adminMutedClass,
  adminTableClass,
  adminTableHeadRowClass,
  adminTableRowClass,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Panel, PanelContent } from "@/components/ui/panel";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/utils";

type Audience = "unconverted" | "all";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function TrialBroadcastPanel({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [audience, setAudience] = useState<Audience>("unconverted");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientCount, setRecipientCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<BroadcastHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const data = await getBroadcastCount(audience);
      setRecipientCount(data.recipients);
    } catch (err) {
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setRecipientCount(0);
    } finally {
      setLoadingCount(false);
    }
  }, [audience, onSessionExpired]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await getBroadcastHistory();
      setHistory(data.broadcasts);
    } catch (err) {
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const canSend = useMemo(() => {
    return subject.trim().length > 0 && body.trim().length > 0 && recipientCount > 0 && !sending;
  }, [subject, body, recipientCount, sending]);

  async function confirmSend() {
    setShowConfirm(false);
    setSending(true);
    try {
      const result = await sendTrialBroadcast({
        subject: subject.trim(),
        body: body.trim(),
        audience,
      });
      setToast({
        type: "success",
        text: `Broadcast sent to ${result.recipients} recipients`,
      });
      setSubject("");
      setBody("");
      await Promise.all([loadCount(), loadHistory()]);
    } catch (err) {
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setToast({
        type: "error",
        text: "Broadcast failed. Please try again.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {toast ? <AdminToast type={toast.type} text={toast.text} /> : null}

      <AdminConfirmDialog
        open={showConfirm}
        title="Confirm broadcast"
        description={`Are you sure you want to send this email to ${recipientCount} recipients? This cannot be undone.`}
        confirmLabel="Confirm Send"
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => void confirmSend()}
      />

      <AdminPanel
        title="Broadcast Email"
        description="Send a one off email to your free trial list."
        className="mt-0"
      >
        <div className="mb-4 space-y-2">
          <p className={cn(adminLabelClass, "uppercase tracking-wide")}>Audience</p>
          <RadioGroup
            value={audience}
            onValueChange={(value) => setAudience(value as Audience)}
            className="space-y-2"
          >
            {(
              [
                {
                  value: "unconverted" as const,
                  title: "Unconverted trial users only",
                  description:
                    "People who tried the trial but have not paid yet. Excludes unsubscribers.",
                },
                {
                  value: "all" as const,
                  title: "All trial users",
                  description:
                    "Everyone who signed up for the trial including converted users. Excludes unsubscribers.",
                },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                htmlFor={`audience-${option.value}`}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--lt-border)] bg-[var(--lt-bg)] p-3"
              >
                <RadioGroupItem
                  id={`audience-${option.value}`}
                  value={option.value}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--lt-text)]">{option.title}</p>
                  <p className="text-xs text-[var(--lt-text-subtle)]">{option.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="mb-4 space-y-2">
          <label className={cn(adminLabelClass, "block uppercase tracking-wide")} htmlFor="broadcast-subject">
            Subject
          </label>
          <Input
            id="broadcast-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="one more thing before you go..."
          />
        </div>

        <div className="mb-4 space-y-2">
          <label className={cn(adminLabelClass, "block uppercase tracking-wide")} htmlFor="broadcast-body">
            Body
          </label>
          <Textarea
            id="broadcast-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="write your message here. keep it simple and human. this will be wrapped in the LeadThur email template automatically."
            className="min-h-[200px] bg-[var(--lt-bg)] focus-visible:border-[var(--lt-accent)]"
          />
        </div>

        <Panel className="mb-4">
          <PanelContent className="p-4">
            <p className={cn(adminLabelClass, "mb-2 uppercase tracking-wide")}>Live Preview</p>
            <div className="mx-auto max-w-[560px] rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface)] p-5">
              <h3 className="mb-3 text-lg font-bold text-[var(--lt-text)]">
                {subject.trim() || "your subject will appear here"}
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--lt-text-muted)]">
                {body.trim() || "your broadcast message preview appears here as you type."}
              </p>
              <span className="mt-5 block rounded-lg bg-[var(--lt-accent)] px-4 py-3 text-center text-sm font-bold text-white">
                Open LeadThur
              </span>
            </div>
          </PanelContent>
        </Panel>

        <div className="mb-4">
          <p className={adminMutedClass}>
            {loadingCount ? "Checking recipients..." : `Sending to ${recipientCount} people`}
          </p>
          {recipientCount === 0 && !loadingCount ? (
            <p className="mt-1 text-sm text-[var(--lt-warning)]">
              No eligible recipients in this segment.
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          disabled={!canSend}
          onClick={() => setShowConfirm(true)}
          className="w-full"
        >
          {sending ? "Sending..." : "Send Broadcast"}
        </Button>

        <div className="mt-8">
          <h3 className="text-sm font-semibold text-[var(--lt-text)]">Previous Broadcasts</h3>
          {loadingHistory ? (
            <AdminLoading label="Loading history..." />
          ) : history.length === 0 ? (
            <EmptyState
              title="No broadcasts sent yet"
              description="Previous broadcast sends will appear here."
              className="mt-2 py-8"
            />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className={adminTableClass}>
                <thead>
                  <tr className={adminTableHeadRowClass}>
                    <th className="px-3 py-2">Date sent</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Audience</th>
                    <th className="px-3 py-2">Recipients</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className={adminTableRowClass}>
                      <td className="px-3 py-3 text-[var(--lt-text-muted)]">
                        {formatDate(row.sent_at)}
                      </td>
                      <td className="px-3 py-3 text-[var(--lt-text)]">{row.subject}</td>
                      <td className="px-3 py-3 text-[var(--lt-text-muted)]">{row.audience}</td>
                      <td className="px-3 py-3 text-[var(--lt-text-muted)]">
                        {row.recipient_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminPanel>
    </>
  );
}
