"use client";

import { useState } from "react";
import RichEmailEditor from "@/components/RichEmailEditor";
import {
  AdminChipButton,
  AdminPanel,
  adminLabelClass,
} from "@/components/admin/admin-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Panel, PanelContent } from "@/components/ui/panel";
import { getAdminToken } from "@/services/admin-api";
import { getApiUrl } from "@/utils/env";
import { cn } from "@/utils/utils";

interface DirectMessagingProps {
  onSessionExpired: () => void;
}

function getAdminHeaders(): HeadersInit {
  const token = getAdminToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function isEmptyHtml(html: string): boolean {
  const stripped = html.replace(/<[^>]*>/g, "").trim();
  return !stripped || html === "<p></p>";
}

function buildPreviewHtml(
  msgHtmlBody: string,
  msgSubject: string,
  msgMode: "single" | "broadcast",
  msgRecipient: string
): string {
  const recipientLine =
    msgMode === "broadcast"
      ? " · BROADCAST TO ALL USERS"
      : ` · To: ${msgRecipient || "(no recipient)"}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Email Preview — ${msgSubject || "No subject"}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:40px 20px;background:#f4f4f4;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;">
    <p style="font-size:12px;color:#9ca3af;margin-bottom:12px;text-align:center;">
      Preview — Subject: <strong>${msgSubject || "(no subject)"}</strong>${recipientLine}
    </p>
    <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
      <div style="background:#7C3AED;padding:24px 32px;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:44px;height:44px;background:rgba(255,255,255,0.15);border-radius:9px;text-align:center;vertical-align:middle;">
              <span style="font-size:14px;font-weight:800;color:white;">LT</span>
            </td>
            <td style="padding-left:12px;">
              <div style="font-size:20px;font-weight:800;color:white;">LeadThur</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.7);letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Business Discovery</div>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:36px 32px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.7;color:#333;">
        ${msgHtmlBody}
      </div>
      <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
          This message was sent from the LeadThur team.<br/>
          Questions? WhatsApp <strong style="color:#374151;">09067285890</strong>
          or email <strong style="color:#374151;">support@leadthur.com</strong>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function DirectMessaging({ onSessionExpired }: DirectMessagingProps) {
  const [msgMode, setMsgMode] = useState<"single" | "broadcast">("single");
  const [msgRecipient, setMsgRecipient] = useState("");
  const [msgSubject, setMsgSubject] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgResult, setMsgResult] = useState("");
  const [msgHtmlBody, setMsgHtmlBody] = useState("");

  const resultSuccess =
    msgResult.includes("success") || msgResult.includes("sent");

  return (
    <AdminPanel
      title="Direct Messaging"
      description="Send branded emails to individual users or all active users."
      className="mt-6"
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {(["single", "broadcast"] as const).map((mode) => (
          <AdminChipButton
            key={mode}
            active={msgMode === mode}
            onClick={() => setMsgMode(mode)}
          >
            {mode === "single" ? "Single User" : "Broadcast to All"}
          </AdminChipButton>
        ))}
      </div>

      {msgMode === "single" && (
        <div className="mb-4 space-y-2">
          <label className={cn(adminLabelClass, "uppercase tracking-wide")} htmlFor="msg-recipient">
            Recipient Email
          </label>
          <Input
            id="msg-recipient"
            value={msgRecipient}
            onChange={(e) => setMsgRecipient(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
      )}

      <div className="mb-4 space-y-2">
        <label className={cn(adminLabelClass, "uppercase tracking-wide")} htmlFor="msg-subject">
          Subject Line
        </label>
        <Input
          id="msg-subject"
          value={msgSubject}
          onChange={(e) => setMsgSubject(e.target.value)}
          placeholder="e.g. Important update about your LeadThur account"
        />
      </div>

      <Panel className="mb-4">
        <PanelContent className="space-y-2 p-4">
          <p className="text-xs font-bold text-[var(--lt-accent-soft)]">
            Personalisation Tokens — click to copy
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { token: "{{firstName}}", desc: "First name" },
              { token: "{{email}}", desc: "Email address" },
              { token: "{{dashboardUrl}}", desc: "Dashboard link" },
            ].map((t) => (
              <button
                key={t.token}
                type="button"
                onClick={() => void navigator.clipboard.writeText(t.token)}
                title="Click to copy"
                className="rounded-md border-0 bg-transparent p-0"
              >
                <Chip className="border-[var(--lt-accent)]/20 bg-[var(--lt-accent)]/10 text-[var(--lt-accent-soft)]">
                  {t.token}
                  <span className="font-normal text-[var(--lt-text-subtle)]"> — {t.desc}</span>
                </Chip>
              </button>
            ))}
          </div>
        </PanelContent>
      </Panel>

      <div className="mb-4 space-y-2">
        <label className={cn(adminLabelClass, "uppercase tracking-wide")}>Email Body</label>
        <RichEmailEditor
          value={msgHtmlBody}
          onChange={setMsgHtmlBody}
          placeholder="Write your email here. Select text to format it. Use the toolbar to add links, images, and more."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (isEmptyHtml(msgHtmlBody)) {
              alert("Write something in the email body first.");
              return;
            }
            const win = window.open("", "_blank");
            if (win) {
              win.document.write(
                buildPreviewHtml(msgHtmlBody, msgSubject, msgMode, msgRecipient)
              );
              win.document.close();
            }
          }}
        >
          Preview Email
        </Button>

        <Button
          type="button"
          disabled={msgSending}
          onClick={() => {
            void (async () => {
              if (!msgSubject) {
                setMsgResult("Add a subject line before sending.");
                return;
              }
              if (msgMode === "single" && !msgRecipient) {
                setMsgResult("Add a recipient email before sending.");
                return;
              }
              if (isEmptyHtml(msgHtmlBody)) {
                setMsgResult("Write something in the email body before sending.");
                return;
              }
              if (msgMode === "broadcast") {
                const confirmed = window.confirm(
                  `Send "${msgSubject}" to ALL active users? This cannot be undone.`
                );
                if (!confirmed) return;
              }

              setMsgSending(true);
              setMsgResult("");

              const apiUrl = getApiUrl();
              if (!apiUrl) {
                setMsgResult("API URL is not configured.");
                setMsgSending(false);
                return;
              }

              try {
                const endpoint = msgMode === "single" ? "send-message" : "broadcast-message";

                const res = await fetch(`${apiUrl}/admin/${endpoint}`, {
                  method: "POST",
                  headers: getAdminHeaders(),
                  body: JSON.stringify({
                    email: msgRecipient,
                    subject: msgSubject,
                    htmlBody: msgHtmlBody,
                  }),
                });

                if (res.status === 401) {
                  onSessionExpired();
                  return;
                }

                const data = (await res.json()) as {
                  success?: boolean;
                  error?: string;
                  message?: string;
                };

                if (data.success) {
                  setMsgResult(
                    msgMode === "single"
                      ? `Email sent successfully to ${msgRecipient}.`
                      : data.message || "Broadcast sent to all active users."
                  );
                  setMsgHtmlBody("");
                  setMsgSubject("");
                  setMsgRecipient("");
                } else {
                  setMsgResult(data.error || "Failed to send.");
                }
              } catch {
                setMsgResult("Failed to send. Check your connection.");
              } finally {
                setMsgSending(false);
              }
            })();
          }}
        >
          {msgSending
            ? "Sending..."
            : msgMode === "single"
              ? "Send Message"
              : "Broadcast to All Users"}
        </Button>
      </div>

      {msgResult ? (
        <Alert variant={resultSuccess ? "success" : "danger"} className="mt-4">
          {msgResult}
        </Alert>
      ) : null}
    </AdminPanel>
  );
}
