"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");

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
            color: "#8888A8",
            lineHeight: 1.7,
            marginBottom: 28,
          }}
        >
          Your activation email is on its way. Check your inbox for your license key. It
          arrives within 60 seconds.
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
