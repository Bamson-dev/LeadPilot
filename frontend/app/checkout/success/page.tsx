"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getApiUrl } from "@/utils/env";
import { fetchOutreachBalance } from "@/services/outreach-api";

type CheckoutKind = "legacy" | "outreach";

interface StoredOutreachCheckout {
  reference: string;
  type: "subscription" | "pack";
  tier?: string;
  pack_id?: string;
  pack_credits?: number;
  balance_before: number;
  created_at: number;
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const gateway = searchParams.get("gateway");
  const isFlutterwave = gateway === "flutterwave";
  const isOutreachReference = Boolean(reference && reference.startsWith("LT-OUT-"));
  const [checkoutKind, setCheckoutKind] = useState<CheckoutKind>(
    isOutreachReference ? "outreach" : "legacy"
  );
  const [status, setStatus] = useState<"loading" | "ok" | "warn" | "error">("loading");
  const [statusText, setStatusText] = useState(
    "Confirming your payment and sending your license key…"
  );
  const [outreachDetail, setOutreachDetail] = useState<string>("");

  function loadStoredOutreachCheckout(): StoredOutreachCheckout | null {
    try {
      const raw = localStorage.getItem("leadthur_outreach_checkout");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredOutreachCheckout;
      if (!parsed.reference || !parsed.type || typeof parsed.balance_before !== "number") {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function clearStoredOutreachCheckout(): void {
    localStorage.removeItem("leadthur_outreach_checkout");
  }

  useEffect(() => {
    if (!isOutreachReference) return;
    setCheckoutKind("outreach");
    setStatus("loading");
    setStatusText("Confirming outreach payment and refreshing your send balance…");
    setOutreachDetail("");

    let cancelled = false;
    const stored = loadStoredOutreachCheckout();
    const expectedReference = stored?.reference;
    const referencesMatch = Boolean(
      stored && reference && expectedReference && reference.includes(expectedReference)
    );
    const maxAttempts = 6;
    const pollDelayMs = 3500;

    async function pollBalance() {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const balance = await fetchOutreachBalance();
        if (cancelled) return;

        const sawPackIncrease = Boolean(
          stored?.type === "pack" &&
            balance &&
            typeof stored.pack_credits === "number" &&
            balance.send_balance >= stored.balance_before + stored.pack_credits
        );
        const sawSubscriptionActive = Boolean(
          stored?.type === "subscription" &&
            balance &&
            balance.subscription_status === "active" &&
            (!stored.tier || balance.subscription_tier === stored.tier)
        );

        if (
          balance &&
          (
            !stored ||
            !referencesMatch ||
            sawPackIncrease ||
            sawSubscriptionActive
          )
        ) {
          setStatus("ok");
          setStatusText("Outreach payment received. Your send balance has been refreshed.");
          setOutreachDetail(
            `Current outreach sends: ${balance.send_balance.toLocaleString()} (Monthly ${balance.monthly_allowance_remaining.toLocaleString()} · Purchased ${balance.purchased_credits.toLocaleString()})`
          );
          clearStoredOutreachCheckout();
          return;
        }

        if (attempt < maxAttempts) {
          setStatus("warn");
          setStatusText(
            "Payment received, but webhook is still processing. Checking your outreach balance again…"
          );
          await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
          if (cancelled) return;
        }
      }

      setStatus("warn");
      setStatusText(
        "Payment is pending confirmation. Please refresh Outreach Billing in a moment to see updated sends."
      );
      if (stored) {
        setOutreachDetail(
          `Reference: ${stored.reference}. Expected update: ${
            stored.type === "pack"
              ? `+${(stored.pack_credits ?? 0).toLocaleString()} outreach sends`
              : "subscription balance refresh"
          }.`
        );
      }
    }

    void pollBalance();
    return () => {
      cancelled = true;
    };
  }, [isOutreachReference, reference]);

  useEffect(() => {
    if (isOutreachReference) {
      return;
    }
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
  }, [reference, gateway, isOutreachReference]);

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
          {checkoutKind === "outreach" ? "Outreach payment received." : "Payment successful."}
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

        {checkoutKind === "outreach" && outreachDetail && (
          <p style={{ fontSize: 12, color: "#A1A1B5", marginBottom: 16, lineHeight: 1.6 }}>
            {outreachDetail}
          </p>
        )}

        <p style={{ fontSize: 12, color: "#7878A0", marginBottom: 20, lineHeight: 1.6 }}>
          {checkoutKind === "outreach"
            ? "This purchase adds email outreach sends only. Search credits are separate and unchanged."
            : isFlutterwave
              ? "Flutterwave sends a payment receipt. LeadThur sends a separate email with your license key from "
              : "Paystack sends a payment receipt. LeadThur sends a separate email with your license key from "}
          {checkoutKind === "legacy" && (
            <strong style={{ color: "#A78BFA" }}>access@leadthur.com</strong>
          )}
          {checkoutKind === "legacy" ? "." : ""}
        </p>

        {reference && (
          <p style={{ fontSize: 13, color: "#7878A0", marginBottom: 28 }}>
            Reference: {reference}
          </p>
        )}

        {checkoutKind === "legacy" ? (
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
        ) : (
          <Link
            href="/dashboard/plans"
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
            Back to Outreach Billing →
          </Link>
        )}

        <Link
          href={checkoutKind === "outreach" ? "/dashboard" : "/"}
          style={{
            display: "block",
            fontSize: 13,
            color: "#7878A0",
            textDecoration: "none",
          }}
        >
          {checkoutKind === "outreach" ? "Back to dashboard" : "Back to leadthur.com"}
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
