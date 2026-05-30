"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "@/utils/env";

export default function SuspendedPage() {
  const [reason, setReason] = useState("Your account has been suspended.");

  useEffect(() => {
    const stored = localStorage.getItem("lp_suspended_reason");
    if (stored) setReason(stored);
  }, []);

  useEffect(() => {
    const email = localStorage.getItem("leadthur_email");
    const key = localStorage.getItem("leadthur_key");

    if (!email || !key) return;

    const apiUrl = getApiUrl();
    if (!apiUrl) return;

    async function checkStatus() {
      try {
        const res = await fetch(`${apiUrl}/auth/status`, {
          headers: {
            "x-license-key": key!,
            "x-license-email": email!,
          },
        });

        const data = (await res.json()) as { valid?: boolean };

        if (data.valid) {
          localStorage.removeItem("lp_suspended_reason");
          window.location.href = "/dashboard";
        }
      } catch {
        // Silent fail
      }
    }

    void checkStatus();
    const interval = setInterval(() => void checkStatus(), 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        background: "#06060A",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          background: "#111118",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 20,
          padding: "40px 32px",
          maxWidth: 460,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            background: "rgba(239,68,68,0.1)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: 28,
          }}
        >
          🚫
        </div>

        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#F0EFFF",
            marginBottom: 12,
            letterSpacing: -0.5,
          }}
        >
          Account Suspended
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "#7878A0",
            lineHeight: 1.7,
            marginBottom: 28,
          }}
        >
          {reason}
        </p>

        <a
          href="https://wa.me/2349067285890"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            background: "#25D366",
            color: "white",
            fontWeight: 700,
            fontSize: 14,
            padding: "14px 24px",
            borderRadius: 10,
            textDecoration: "none",
            marginBottom: 12,
          }}
        >
          Contact Support on WhatsApp
        </a>

        <p style={{ fontSize: 12, color: "#555575" }}>
          WhatsApp: 09067285890 · access@leadthur.com
        </p>

        <p
          style={{
            fontSize: 12,
            color: "#555575",
            marginTop: 16,
            lineHeight: 1.6,
          }}
        >
          This page checks automatically every 10 seconds.
          <br />
          You will be redirected to your dashboard as soon as your account is restored.
        </p>
      </div>
    </div>
  );
}
