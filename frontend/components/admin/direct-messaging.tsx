"use client";

import { useState } from "react";
import { getAdminToken } from "@/services/admin-api";
import { getApiUrl } from "@/utils/env";

type MsgBlock = {
  id: string;
  type: "text" | "bold" | "italic" | "link" | "button" | "image" | "divider" | "spacer";
  content: string;
  url?: string;
  buttonColor?: string;
  imageAlt?: string;
  align?: "left" | "center" | "right";
};

interface DirectMessagingProps {
  onSessionExpired: () => void;
}

function newBlockId(): string {
  return Math.random().toString(36).substring(2, 8);
}

function blocksToHtml(blocks: MsgBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "text":
          return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#333333;font-family:Inter,sans-serif;">${block.content.replace(/\n/g, "<br/>")}</p>`;
        case "bold":
          return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#1a1a1a;font-weight:700;font-family:Inter,sans-serif;">${block.content}</p>`;
        case "italic":
          return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#555555;font-style:italic;font-family:Inter,sans-serif;">${block.content}</p>`;
        case "link":
          return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;font-family:Inter,sans-serif;"><a href="${block.url}" style="color:#7C3AED;font-weight:600;text-decoration:underline;">${block.content}</a></p>`;
        case "button":
          return `<div style="margin:24px 0;text-align:${block.align || "center"};"><a href="${block.url}" style="display:inline-block;background:${block.buttonColor || "#7C3AED"};color:white;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:Inter,sans-serif;">${block.content}</a></div>`;
        case "image":
          return `<div style="margin:20px 0;text-align:${block.align || "center"};"><img src="${block.url}" alt="${block.imageAlt || ""}" style="max-width:100%;border-radius:8px;" /></div>`;
        case "divider":
          return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />`;
        case "spacer":
          return `<div style="height:24px;"></div>`;
        default:
          return "";
      }
    })
    .join("\n");
}

function getAdminHeaders(): HeadersInit {
  const token = getAdminToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function DirectMessaging({ onSessionExpired }: DirectMessagingProps) {
  const [msgMode, setMsgMode] = useState<"single" | "broadcast">("single");
  const [msgRecipient, setMsgRecipient] = useState("");
  const [msgSubject, setMsgSubject] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgResult, setMsgResult] = useState("");
  const [msgBlocks, setMsgBlocks] = useState<MsgBlock[]>([
    { id: "1", type: "text", content: "Hi {{firstName}}," },
    { id: "2", type: "text", content: "" },
    { id: "3", type: "text", content: "Your message goes here." },
  ]);
  const [showBlockMenu, setShowBlockMenu] = useState(false);

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
            placeholder="e.g. Important update about your account"
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
          <p style={{ fontSize: 10, color: "#555570", marginTop: 5 }}>
            Use {"{{firstName}}"} to personalise with the recipient name
          </p>
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

          <div
            style={{
              background: "#0A0A10",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: 12,
              marginBottom: 10,
            }}
          >
            {msgBlocks.map((block, index) => (
              <div
                key={block.id}
                style={{
                  background: "#111118",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 8,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#7C3AED",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                  }}
                >
                  {block.type === "text" && "Paragraph"}
                  {block.type === "bold" && "Bold Text"}
                  {block.type === "italic" && "Italic Text"}
                  {block.type === "link" && "Link"}
                  {block.type === "button" && "Button"}
                  {block.type === "image" && "Image"}
                  {block.type === "divider" && "Divider"}
                  {block.type === "spacer" && "Spacer"}
                </div>

                {["text", "bold", "italic"].includes(block.type) && (
                  <textarea
                    value={block.content}
                    onChange={(e) => {
                      const updated = [...msgBlocks];
                      updated[index] = { ...block, content: e.target.value };
                      setMsgBlocks(updated);
                    }}
                    rows={2}
                    placeholder={
                      block.type === "text"
                        ? "Type your paragraph here. Use {{firstName}} for personalisation."
                        : block.type === "bold"
                          ? "Bold text here..."
                          : "Italic text here..."
                    }
                    style={{
                      width: "100%",
                      background: "#0A0A10",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      fontSize: 12,
                      color: "#F2F1FF",
                      fontFamily: "Inter, sans-serif",
                      resize: "vertical",
                      outline: "none",
                    }}
                  />
                )}

                {block.type === "link" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={block.content}
                      onChange={(e) => {
                        const updated = [...msgBlocks];
                        updated[index] = { ...block, content: e.target.value };
                        setMsgBlocks(updated);
                      }}
                      placeholder="Link text e.g. Click here"
                      style={{
                        flex: 1,
                        background: "#0A0A10",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        fontSize: 12,
                        color: "#F2F1FF",
                        fontFamily: "Inter, sans-serif",
                        outline: "none",
                      }}
                    />
                    <input
                      value={block.url || ""}
                      onChange={(e) => {
                        const updated = [...msgBlocks];
                        updated[index] = { ...block, url: e.target.value };
                        setMsgBlocks(updated);
                      }}
                      placeholder="https://leadthur.com"
                      style={{
                        flex: 2,
                        background: "#0A0A10",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        fontSize: 12,
                        color: "#F2F1FF",
                        fontFamily: "Inter, sans-serif",
                        outline: "none",
                      }}
                    />
                  </div>
                )}

                {block.type === "button" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={block.content}
                        onChange={(e) => {
                          const updated = [...msgBlocks];
                          updated[index] = { ...block, content: e.target.value };
                          setMsgBlocks(updated);
                        }}
                        placeholder="Button text e.g. Get Access Now"
                        style={{
                          flex: 1,
                          background: "#0A0A10",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 6,
                          padding: "8px 10px",
                          fontSize: 12,
                          color: "#F2F1FF",
                          fontFamily: "Inter, sans-serif",
                          outline: "none",
                        }}
                      />
                      <input
                        value={block.url || ""}
                        onChange={(e) => {
                          const updated = [...msgBlocks];
                          updated[index] = { ...block, url: e.target.value };
                          setMsgBlocks(updated);
                        }}
                        placeholder="https://leadthur.com/checkout"
                        style={{
                          flex: 2,
                          background: "#0A0A10",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 6,
                          padding: "8px 10px",
                          fontSize: 12,
                          color: "#F2F1FF",
                          fontFamily: "Inter, sans-serif",
                          outline: "none",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <label style={{ fontSize: 10, color: "#555570", whiteSpace: "nowrap" }}>
                        Button Color
                      </label>
                      <input
                        type="color"
                        value={block.buttonColor || "#7C3AED"}
                        onChange={(e) => {
                          const updated = [...msgBlocks];
                          updated[index] = { ...block, buttonColor: e.target.value };
                          setMsgBlocks(updated);
                        }}
                        style={{
                          width: 40,
                          height: 28,
                          borderRadius: 4,
                          border: "none",
                          cursor: "pointer",
                          background: "none",
                        }}
                      />
                      <label style={{ fontSize: 10, color: "#555570" }}>Align</label>
                      {(["left", "center", "right"] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => {
                            const updated = [...msgBlocks];
                            updated[index] = { ...block, align: a };
                            setMsgBlocks(updated);
                          }}
                          style={{
                            background: block.align === a ? "#7C3AED" : "rgba(255,255,255,0.05)",
                            border: "none",
                            borderRadius: 4,
                            padding: "3px 8px",
                            fontSize: 10,
                            color: "white",
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {block.type === "image" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      value={block.url || ""}
                      onChange={(e) => {
                        const updated = [...msgBlocks];
                        updated[index] = { ...block, url: e.target.value };
                        setMsgBlocks(updated);
                      }}
                      placeholder="https://example.com/image.png"
                      style={{
                        width: "100%",
                        background: "#0A0A10",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        fontSize: 12,
                        color: "#F2F1FF",
                        fontFamily: "Inter, sans-serif",
                        outline: "none",
                      }}
                    />
                    <input
                      value={block.imageAlt || ""}
                      onChange={(e) => {
                        const updated = [...msgBlocks];
                        updated[index] = { ...block, imageAlt: e.target.value };
                        setMsgBlocks(updated);
                      }}
                      placeholder="Image description"
                      style={{
                        width: "100%",
                        background: "#0A0A10",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        fontSize: 12,
                        color: "#F2F1FF",
                        fontFamily: "Inter, sans-serif",
                        outline: "none",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <label style={{ fontSize: 10, color: "#555570" }}>Align</label>
                      {(["left", "center", "right"] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => {
                            const updated = [...msgBlocks];
                            updated[index] = { ...block, align: a };
                            setMsgBlocks(updated);
                          }}
                          style={{
                            background: block.align === a ? "#7C3AED" : "rgba(255,255,255,0.05)",
                            border: "none",
                            borderRadius: 4,
                            padding: "3px 8px",
                            fontSize: 10,
                            color: "white",
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 8,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (index === 0) return;
                      const updated = [...msgBlocks];
                      const temp = updated[index - 1];
                      updated[index - 1] = updated[index];
                      updated[index] = temp;
                      setMsgBlocks(updated);
                    }}
                    disabled={index === 0}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 5,
                      padding: "3px 8px",
                      fontSize: 10,
                      color: "#8888A8",
                      cursor: index === 0 ? "not-allowed" : "pointer",
                      opacity: index === 0 ? 0.4 : 1,
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (index === msgBlocks.length - 1) return;
                      const updated = [...msgBlocks];
                      const temp = updated[index + 1];
                      updated[index + 1] = updated[index];
                      updated[index] = temp;
                      setMsgBlocks(updated);
                    }}
                    disabled={index === msgBlocks.length - 1}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 5,
                      padding: "3px 8px",
                      fontSize: 10,
                      color: "#8888A8",
                      cursor: index === msgBlocks.length - 1 ? "not-allowed" : "pointer",
                      opacity: index === msgBlocks.length - 1 ? 0.4 : 1,
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setMsgBlocks(msgBlocks.filter((_, i) => i !== index))}
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: 5,
                      padding: "3px 8px",
                      fontSize: 10,
                      color: "#EF4444",
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowBlockMenu(!showBlockMenu)}
                style={{
                  width: "100%",
                  background: "rgba(124,58,237,0.06)",
                  border: "1px dashed rgba(124,58,237,0.3)",
                  borderRadius: 8,
                  padding: "10px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#A78BFA",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                + Add Block
              </button>

              {showBlockMenu && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "110%",
                    left: 0,
                    right: 0,
                    background: "#111118",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    padding: 8,
                    zIndex: 100,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                  }}
                >
                  {[
                    { type: "text", label: "¶ Paragraph", desc: "Regular text block" },
                    { type: "bold", label: "B Bold Text", desc: "Heavy weight text" },
                    { type: "italic", label: "I Italic Text", desc: "Emphasised text" },
                    { type: "link", label: "🔗 Link", desc: "Clickable text link" },
                    { type: "button", label: "🟣 Button", desc: "CTA button with URL" },
                    { type: "image", label: "🖼 Image", desc: "Image from URL" },
                    { type: "divider", label: "— Divider", desc: "Horizontal line" },
                    { type: "spacer", label: "↕ Spacer", desc: "Empty space" },
                  ].map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => {
                        const newBlock: MsgBlock = {
                          id: newBlockId(),
                          type: item.type as MsgBlock["type"],
                          content: "",
                          url: "",
                          buttonColor: "#7C3AED",
                          align: "center",
                        };
                        setMsgBlocks([...msgBlocks, newBlock]);
                        setShowBlockMenu(false);
                      }}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        textAlign: "left",
                        cursor: "pointer",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#F2F1FF" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 10, color: "#555570", marginTop: 2 }}>{item.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              background: "rgba(124,58,237,0.06)",
              border: "1px solid rgba(124,58,237,0.15)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA", marginBottom: 6 }}>
              Personalisation Tokens
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { token: "{{firstName}}", desc: "User first name" },
                { token: "{{email}}", desc: "User email" },
                { token: "{{dashboardUrl}}", desc: "Dashboard link" },
              ].map((t) => (
                <div
                  key={t.token}
                  style={{
                    background: "rgba(124,58,237,0.1)",
                    border: "1px solid rgba(124,58,237,0.2)",
                    borderRadius: 6,
                    padding: "3px 8px",
                    fontSize: 11,
                    color: "#A78BFA",
                    fontWeight: 600,
                  }}
                >
                  {t.token}{" "}
                  <span style={{ color: "#555570", fontWeight: 400 }}>— {t.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const html = blocksToHtml(msgBlocks);
            const win = window.open("", "_blank");
            if (win) {
              win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Email Preview</title>
            </head>
            <body style="margin:0;padding:40px;background:#f4f4f4;font-family:Inter,Arial,sans-serif;">
              <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
                <div style="background:#7C3AED;padding:24px 32px;display:flex;align-items:center;gap:12px;">
                  <div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:white;">LT</div>
                  <div>
                    <div style="font-size:20px;font-weight:800;color:white;">LeadThur</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;">Business Discovery</div>
                  </div>
                </div>
                <div style="padding:36px 32px;">
                  ${html}
                </div>
                <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
                  This message was sent from the LeadThur team.
                  Questions? WhatsApp <strong style="color:#374151;">09067285890</strong>
                  or email <strong style="color:#374151;">support@leadthur.com</strong>
                </div>
              </div>
            </body>
            </html>
          `);
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
            marginBottom: 10,
            marginRight: 10,
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
              if (msgBlocks.length === 0) {
                setMsgResult("Add at least one content block before sending.");
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

              const htmlBody = blocksToHtml(msgBlocks);
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
                    htmlBody,
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
                  setMsgBlocks([{ id: newBlockId(), type: "text", content: "" }]);
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
            padding: "12px 28px",
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
