"use client";

import { useState } from "react";
import { sendBroadcast, sendMessage } from "@/services/admin-api";

interface DirectMessagingProps {
  onSessionExpired: () => void;
}

export function DirectMessaging({ onSessionExpired }: DirectMessagingProps) {
  const [msgTab, setMsgTab] = useState<"single" | "broadcast">("single");
  const [msgEmail, setMsgEmail] = useState("");
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [msgLoading, setMsgLoading] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [msgSuccess, setMsgSuccess] = useState("");
  const [msgError, setMsgError] = useState("");

  async function handleSendMessage() {
    if (!msgEmail || !msgSubject || !msgBody) {
      setMsgError("All fields are required");
      return;
    }
    setMsgLoading(true);
    setMsgError("");
    setMsgSuccess("");
    try {
      await sendMessage(msgEmail, msgSubject, msgBody);
      setMsgSuccess(`Message sent to ${msgEmail}`);
      setMsgEmail("");
      setMsgSubject("");
      setMsgBody("");
      setTimeout(() => setMsgSuccess(""), 5000);
    } catch (err) {
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setMsgError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setMsgLoading(false);
    }
  }

  async function handleBroadcast() {
    if (!broadcastSubject || !broadcastBody) {
      setMsgError("Subject and message are required");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to send this to ALL active users?\n\nSubject: ${broadcastSubject}\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    setBroadcastLoading(true);
    setMsgError("");
    setMsgSuccess("");
    try {
      const result = await sendBroadcast(broadcastSubject, broadcastBody);
      setMsgSuccess(result.message || "Broadcast sent successfully");
      setBroadcastSubject("");
      setBroadcastBody("");
      setTimeout(() => setMsgSuccess(""), 8000);
    } catch (err) {
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setMsgError(err instanceof Error ? err.message : "Failed to send broadcast");
    } finally {
      setBroadcastLoading(false);
    }
  }

  return (
    <div
      style={{
        background: "#FAFAFA",
        border: "1px solid #E5E5E5",
        borderRadius: 16,
        padding: 28,
        marginTop: 24,
      }}
    >
      <h3
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: "#111111",
          marginBottom: 6,
        }}
      >
        Direct Messaging
      </h3>
      <p style={{ fontSize: 13, color: "#888888", marginBottom: 20 }}>
        Send emails to individual users or broadcast to all active users.
      </p>

      <div
        style={{
          display: "flex",
          background: "#EEEEEE",
          borderRadius: 10,
          padding: 4,
          marginBottom: 24,
          width: "fit-content",
        }}
      >
        <button
          type="button"
          onClick={() => setMsgTab("single")}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            background: msgTab === "single" ? "#ffffff" : "transparent",
            color: msgTab === "single" ? "#111111" : "#888888",
            boxShadow: msgTab === "single" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            fontFamily: "Inter, sans-serif",
            transition: "all 0.15s",
          }}
        >
          Single User
        </button>
        <button
          type="button"
          onClick={() => setMsgTab("broadcast")}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            background: msgTab === "broadcast" ? "#ffffff" : "transparent",
            color: msgTab === "broadcast" ? "#111111" : "#888888",
            boxShadow: msgTab === "broadcast" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            fontFamily: "Inter, sans-serif",
            transition: "all 0.15s",
          }}
        >
          Broadcast to All
        </button>
      </div>

      {msgTab === "single" && (
        <div>
          <input
            type="email"
            placeholder="Recipient email address"
            value={msgEmail}
            onChange={(e) => setMsgEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid #DDDDDD",
              fontSize: 13,
              marginBottom: 10,
              background: "#ffffff",
              color: "#111111",
              fontFamily: "Inter, sans-serif",
              outline: "none",
            }}
          />
          <input
            type="text"
            placeholder="Subject"
            value={msgSubject}
            onChange={(e) => setMsgSubject(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid #DDDDDD",
              fontSize: 13,
              marginBottom: 10,
              background: "#ffffff",
              color: "#111111",
              fontFamily: "Inter, sans-serif",
              outline: "none",
            }}
          />
          <textarea
            placeholder="Type your message here..."
            value={msgBody}
            onChange={(e) => setMsgBody(e.target.value)}
            rows={6}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid #DDDDDD",
              fontSize: 13,
              marginBottom: 14,
              background: "#ffffff",
              color: "#111111",
              fontFamily: "Inter, sans-serif",
              outline: "none",
              resize: "vertical",
            }}
          />
          <button
            type="button"
            onClick={() => void handleSendMessage()}
            disabled={msgLoading}
            style={{
              background: "#7C3AED",
              color: "white",
              border: "none",
              padding: "13px 28px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: msgLoading ? "not-allowed" : "pointer",
              opacity: msgLoading ? 0.7 : 1,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {msgLoading ? "Sending..." : "Send Message"}
          </button>
        </div>
      )}

      {msgTab === "broadcast" && (
        <div>
          <div
            style={{
              background: "#FFFBEB",
              border: "1px solid #FCD34D",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 16,
              fontSize: 13,
              color: "#92400E",
              lineHeight: 1.6,
            }}
          >
            ⚠️ You are about to send an email to ALL active LeadPilot users. Double check
            your message before sending.
          </div>
          <input
            type="text"
            placeholder="Subject"
            value={broadcastSubject}
            onChange={(e) => setBroadcastSubject(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid #DDDDDD",
              fontSize: 13,
              marginBottom: 10,
              background: "#ffffff",
              color: "#111111",
              fontFamily: "Inter, sans-serif",
              outline: "none",
            }}
          />
          <textarea
            placeholder="Type your broadcast message here..."
            value={broadcastBody}
            onChange={(e) => setBroadcastBody(e.target.value)}
            rows={6}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid #DDDDDD",
              fontSize: 13,
              marginBottom: 14,
              background: "#ffffff",
              color: "#111111",
              fontFamily: "Inter, sans-serif",
              outline: "none",
              resize: "vertical",
            }}
          />
          <button
            type="button"
            onClick={() => void handleBroadcast()}
            disabled={broadcastLoading}
            style={{
              background: "#DC2626",
              color: "white",
              border: "none",
              padding: "13px 28px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: broadcastLoading ? "not-allowed" : "pointer",
              opacity: broadcastLoading ? 0.7 : 1,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {broadcastLoading ? "Sending..." : "Send to All Users"}
          </button>
        </div>
      )}

      {msgSuccess && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "#ECFDF5",
            border: "1px solid #6EE7B7",
            borderRadius: 8,
            fontSize: 13,
            color: "#065F46",
            fontWeight: 600,
          }}
        >
          {msgSuccess}
        </div>
      )}
      {msgError && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 8,
            fontSize: 13,
            color: "#991B1B",
            fontWeight: 600,
          }}
        >
          {msgError}
        </div>
      )}
    </div>
  );
}
