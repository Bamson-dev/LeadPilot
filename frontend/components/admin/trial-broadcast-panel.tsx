"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getBroadcastCount,
  getBroadcastHistory,
  sendTrialBroadcast,
  type BroadcastHistoryRow,
} from "@/services/admin-api";

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
    <section className="glass mt-8 rounded-2xl p-6">
      {toast ? (
        <div
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 1000,
            padding: "12px 14px",
            borderRadius: 10,
            background: toast.type === "success" ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          {toast.text}
        </div>
      ) : null}

      {showConfirm ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#111118",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: 18,
            }}
          >
            <h3 style={{ margin: 0, color: "#F4F4FF", fontSize: 16, fontWeight: 800 }}>
              Confirm broadcast
            </h3>
            <p style={{ marginTop: 10, marginBottom: 14, color: "#C0C0D8", fontSize: 13, lineHeight: 1.6 }}>
              Are you sure you want to send this email to {recipientCount} recipients? This cannot
              be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#C0C0D8] hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmSend()}
                className="rounded-lg bg-[#7C3AED] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6D28D9]"
              >
                Confirm Send
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[#F4F4FF]">Broadcast Email</h2>
        <p className="text-sm text-[#8888A8]">Send a one off email to your free trial list.</p>
      </div>

      <div className="mb-4 space-y-2">
        <label className="block text-xs uppercase tracking-wide text-[#8888A8]">Audience</label>
        <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-[#111118] p-3">
          <input
            type="radio"
            name="audience"
            checked={audience === "unconverted"}
            onChange={() => setAudience("unconverted")}
          />
          <div>
            <p className="text-sm font-semibold text-[#F4F4FF]">Unconverted trial users only</p>
            <p className="text-xs text-[#8888A8]">
              People who tried the trial but have not paid yet. Excludes unsubscribers.
            </p>
          </div>
        </label>
        <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-[#111118] p-3">
          <input
            type="radio"
            name="audience"
            checked={audience === "all"}
            onChange={() => setAudience("all")}
          />
          <div>
            <p className="text-sm font-semibold text-[#F4F4FF]">All trial users</p>
            <p className="text-xs text-[#8888A8]">
              Everyone who signed up for the trial including converted users. Excludes unsubscribers.
            </p>
          </div>
        </label>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs uppercase tracking-wide text-[#8888A8]">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="one more thing before you go..."
          className="w-full rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-sm text-[#F4F4FF] outline-none"
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs uppercase tracking-wide text-[#8888A8]">Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="write your message here. keep it simple and human. this will be wrapped in the LeadThur email template automatically."
          style={{ minHeight: 200 }}
          className="w-full resize-y rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-sm text-[#F4F4FF] outline-none"
        />
      </div>

      <div className="mb-4 rounded-xl border border-white/10 bg-[#111118] p-4">
        <p className="mb-2 text-xs uppercase tracking-wide text-[#8888A8]">Live Preview</p>
        <div className="mx-auto max-w-[560px] rounded-lg border border-[#E5E7EB] bg-white p-5">
          <h3 className="mb-3 text-lg font-bold text-[#09090b]">
            {subject.trim() || "your subject will appear here"}
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-7 text-[#3f3f46]">
            {body.trim() || "your broadcast message preview appears here as you type."}
          </p>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              display: "block",
              marginTop: 20,
              textAlign: "center",
              background: "#7C3AED",
              color: "#fff",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Open LeadThur
          </a>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-[#C0C0D8]">
          {loadingCount ? "Checking recipients..." : `Sending to ${recipientCount} people`}
        </p>
        {recipientCount === 0 && !loadingCount ? (
          <p className="mt-1 text-sm text-amber-400">No eligible recipients in this segment.</p>
        ) : null}
      </div>

      <button
        type="button"
        disabled={!canSend}
        onClick={() => setShowConfirm(true)}
        className="w-full rounded-lg bg-[#7C3AED] py-3 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-50"
      >
        {sending ? "Sending..." : "Send Broadcast"}
      </button>

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-[#F4F4FF]">Previous Broadcasts</h3>
        {loadingHistory ? (
          <p className="mt-2 text-sm text-[#8888A8]">Loading history...</p>
        ) : history.length === 0 ? (
          <p className="mt-2 text-sm text-[#8888A8]">No broadcasts sent yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-[#8888A8]">
                  <th className="px-3 py-2">Date sent</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Audience</th>
                  <th className="px-3 py-2">Recipients</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="px-3 py-3 text-[#C0C0D8]">{formatDate(row.sent_at)}</td>
                    <td className="px-3 py-3 text-[#F4F4FF]">{row.subject}</td>
                    <td className="px-3 py-3 text-[#C0C0D8]">{row.audience}</td>
                    <td className="px-3 py-3 text-[#C0C0D8]">{row.recipient_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
