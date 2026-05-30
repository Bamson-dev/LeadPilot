"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getApiUrl } from "@/utils/env";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const gateway = searchParams.get("gateway");
  const isFlutterwave = gateway === "flutterwave";
  const [status, setStatus] = useState<"loading" | "ok" | "warn" | "error">("loading");
  const [statusText, setStatusText] = useState(
    "Confirming your payment and sending your license key…"
  );

  useEffect(() => {
    if (!reference) {
      setStatus("warn");
      setStatusText(
        "Payment received. If you do not get an email within 2 minutes, contact support on WhatsApp 09067285890."
      );
      return;
    }

    let cancelled = false;

    async function verifyPayment() {
      try {
        const res = await fetch(`${getApiUrl()}/checkout/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference,
            gateway: gateway || "paystack",
          }),
        });
        const data = (await res.json()) as {
          message?: string;
          emailSent?: boolean;
          error?: string;
        };

        if (cancelled) return;

        if (res.ok) {
          setStatus(data.emailSent ? "ok" : "warn");
          setStatusText(
            data.message ||
              (data.emailSent
                ? "Activation email sent. Check inbox and spam."
                : "License created. Check spam or contact support for your key.")
          );
        } else {
          setStatus("warn");
          setStatusText(
            data.error ||
              "Payment is processing. Your license email may arrive shortly — also check spam."
          );
        }
      } catch {
        if (!cancelled) {
          setStatus("warn");
          setStatusText(
            "Payment received. If no email arrives in 2 minutes, WhatsApp 09067285890 with your payment reference."
          );
        }
      }
    }

    void verifyPayment();
    return () => {
      cancelled = true;
    };
  }, [reference, gateway]);

  return (
    <div
      style={{
        background: "#050508",
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
          border: "1px solid rgba(16,185,129,0.3)",
          borderRadius: 20,
          padding: "40px 32px",
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 0 80px rgba(16,185,129,0.1)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            background: "rgba(16,185,129,0.1)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: 28,
            color: "#10B981",
          }}
        >
          ✓
        </div>

        <h1
          style={{
            fontSize: 26,
            fontWeight: 900,
            color: "#F2F1FF",
            letterSpacing: -0.5,
            marginBottom: 10,
          }}
        >
          Payment successful.
        </h1>

        <p
          style={{
            fontSize: 15,
            color: status === "error" ? "#EF4444" : status === "warn" ? "#FCD34D" : "#8888A8",
            lineHeight: 1.7,
            marginBottom: 28,
          }}
        >
          {statusText}
        </p>

        <p style={{ fontSize: 12, color: "#7878A0", marginBottom: 20, lineHeight: 1.6 }}>
          {isFlutterwave
            ? "Flutterwave sends a payment receipt. LeadPilot sends a separate email with your license key from "
            : "Paystack sends a payment receipt. LeadPilot sends a separate email with your license key from "}
          <strong style={{ color: "#A78BFA" }}>access@leadpilot.live</strong>.
        </p>

        {reference && (
          <p style={{ fontSize: 13, color: "#7878A0", marginBottom: 28 }}>
            Reference: {reference}
          </p>
        )}

        <Link
          href="/activate"
          style={{
            display: "block",
            background: "#7C3AED",
            color: "white",
            fontWeight: 800,
            fontSize: 15,
            padding: "16px",
            borderRadius: 12,
            textDecoration: "none",
            marginBottom: 12,
            boxShadow: "0 0 40px rgba(124,58,237,0.3)",
          }}
        >
          Activate My Account →
        </Link>

        <Link
          href="/"
          style={{
            display: "block",
            fontSize: 13,
            color: "#7878A0",
            textDecoration: "none",
          }}
        >
          Back to LeadPilot.live
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            background: "#050508",
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#8888A8",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Loading…
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
