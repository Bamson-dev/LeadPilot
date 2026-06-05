"use client";

import { useState } from "react";
import RichEmailEditor from "@/components/RichEmailEditor";
import { getAdminToken } from "@/services/admin-api";
import { getApiUrl } from "@/utils/env";

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

  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 24,
        marginTop: 24,
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F2F1FF", margin: 0 }}>
          Direct Messaging
        </h3>
        <p style={{ fontSize: 11, color: "#555570", marginTop: 3 }}>
          Send branded emails to individual users or all active users
        </p>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["single", "broadcast"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMsgMode(mode)}
              style={{
                background: msgMode === mode ? "#7C3AED" : "rgba(255,255,255,0.04)",
                border: `1px solid ${msgMode === mode ? "#7C3AED" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 8,
                padding: "7px 16px",
                fontSize: 12,
                fontWeight: 700,
                color: msgMode === mode ? "white" : "#8888A8",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {mode === "single" ? "Single User" : "Broadcast to All"}
            </button>
          ))}
        </div>

        {msgMode === "single" && (
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: "#8888A8",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Recipient Email
            </label>
            <input
              value={msgRecipient}
              onChange={(e) => setMsgRecipient(e.target.value)}
              placeholder="user@example.com"
              style={{
                width: "100%",
                background: "#0A0A10",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                color: "#F2F1FF",
                fontFamily: "Inter, sans-serif",
                outline: "none",
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: "#8888A8",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            Subject Line
          </label>
          <input
            value={msgSubject}
            onChange={(e) => setMsgSubject(e.target.value)}
            placeholder="e.g. Important update about your LeadThur account"
            style={{
              width: "100%",
              background: "#0A0A10",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              color: "#F2F1FF",
              fontFamily: "Inter, sans-serif",
              outline: "none",
            }}
          />
        </div>

        <div
          style={{
            background: "rgba(124,58,237,0.06)",
            border: "1px solid rgba(124,58,237,0.15)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA", marginBottom: 6 }}>
            Personalisation Tokens — click to copy
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { token: "{{firstName}}", desc: "First name" },
              { token: "{{email}}", desc: "Email address" },
              { token: "{{dashboardUrl}}", desc: "Dashboard link" },
            ].map((t) => (
              <button
                key={t.token}
                type="button"
                onClick={() => void navigator.clipboard.writeText(t.token)}
                style={{
                  background: "rgba(124,58,237,0.1)",
                  border: "1px solid rgba(124,58,237,0.2)",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  color: "#A78BFA",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
                title="Click to copy"
              >
                {t.token}
                <span style={{ color: "#555570", fontWeight: 400 }}> — {t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: "#8888A8",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            Email Body
          </label>
          <RichEmailEditor
            value={msgHtmlBody}
            onChange={setMsgHtmlBody}
            placeholder="Write your email here. Select text to format it. Use the toolbar to add links, images, and more."
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button
            type="button"
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
            style={{
              background: "transparent",
              border: "1px solid rgba(124,58,237,0.4)",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 12,
              fontWeight: 700,
              color: "#A78BFA",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Preview Email
          </button>

          <button
            type="button"
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
                  const endpoint =
                    msgMode === "single" ? "send-message" : "broadcast-message";

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
            disabled={msgSending}
            style={{
              background: msgSending ? "#1A1A24" : "#7C3AED",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 700,
              cursor: msgSending ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif",
              opacity: msgSending ? 0.7 : 1,
            }}
          >
            {msgSending
              ? "Sending..."
              : msgMode === "single"
                ? "Send Message"
                : "Broadcast to All Users"}
          </button>
        </div>

        {msgResult && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background:
                msgResult.includes("success") || msgResult.includes("sent")
                  ? "rgba(16,185,129,0.08)"
                  : "rgba(239,68,68,0.08)",
              border: `1px solid ${
                msgResult.includes("success") || msgResult.includes("sent")
                  ? "rgba(16,185,129,0.2)"
                  : "rgba(239,68,68,0.2)"
              }`,
              borderRadius: 8,
              fontSize: 12,
              color:
                msgResult.includes("success") || msgResult.includes("sent")
                  ? "#10B981"
                  : "#EF4444",
              fontWeight: 600,
            }}
          >
            {msgResult}
          </div>
        )}
      </div>
    </div>
  );
}
