"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import { detectCountry } from "@/lib/geolocation";
import { LIFETIME_PRICE_KOBO, SALE_PRICE_USD } from "@/constants/pricing";
import { getApiUrl } from "@/utils/env";

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";
const FLW_PUBLIC_KEY = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ?? "";

function generateFlwTxRef(): string {
  return `LP-FLW-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export default function CheckoutPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [flwTxRef, setFlwTxRef] = useState(generateFlwTxRef);

  const isNigeriaGateway = country === "NG";

  useEffect(() => {
    detectCountry().then((code) => {
      setCountry(code);
      setDetecting(false);
    });
  }, []);

  function getRefCode(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("lp_ref_code");
  }

  const frontendUrl =
    process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/$/, "") ||
    "https://www.leadpilot.live";

  const flwConfig = useMemo(
    () => ({
      public_key: FLW_PUBLIC_KEY,
      tx_ref: flwTxRef,
      amount: SALE_PRICE_USD,
      currency: "USD",
      payment_options: "card",
      customer: {
        email: email || "customer@leadpilot.live",
        name: email ? email.split("@")[0] : "Customer",
        phone_number: "",
      },
      customizations: {
        title: "LeadPilot Lifetime Access",
        description: "One payment. Find clients forever.",
        logo: `${frontendUrl}/logo.png`,
      },
      meta: {
        ref_code: getRefCode() || "",
        product: "LeadPilot Lifetime",
        gateway: "flutterwave",
      },
    }),
    [email, flwTxRef, frontendUrl]
  );

  const handleFlutterwave = useFlutterwave(flwConfig);

  async function handlePaystack() {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const refCode = getRefCode();
      const apiUrl = getApiUrl();
      if (!apiUrl) {
        throw new Error("Payment is not configured");
      }

      const res = await fetch(`${apiUrl}/checkout/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, refCode }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to initialize payment");
      }

      const data = (await res.json()) as {
        reference: string;
        accessCode: string;
      };

      if (!PAYSTACK_PUBLIC_KEY) {
        throw new Error("Payment is not configured");
      }

      const PaystackPop = (
        window as {
          PaystackPop?: {
            setup: (opts: object) => { openIframe: () => void };
          };
        }
      ).PaystackPop;

      if (!PaystackPop) {
        throw new Error("Paystack is still loading. Please try again.");
      }

      const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: LIFETIME_PRICE_KOBO,
        currency: "NGN",
        ref: data.reference,
        access_code: data.accessCode,
        metadata: {
          ref_code: refCode || "",
          product: "LeadPilot Lifetime",
          gateway: "paystack",
        },
        onClose: () => setLoading(false),
        callback: (response: { reference: string }) => {
          window.location.href = `/checkout/success?reference=${encodeURIComponent(response.reference)}&gateway=paystack`;
        },
      });

      handler.openIframe();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  }

  function handleFlutterwavePay() {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (!FLW_PUBLIC_KEY) {
      setError("Payment is not configured");
      return;
    }

    setError("");
    setLoading(true);

    const txRef = flwTxRef;

    handleFlutterwave({
      callback: (response) => {
        closePaymentModal();
        if (response.status === "successful") {
          const ref =
            (response as { tx_ref?: string }).tx_ref ||
            response.transaction_id ||
            txRef;
          window.location.href = `/checkout/success?reference=${encodeURIComponent(String(ref))}&gateway=flutterwave`;
        } else {
          setError("Payment was not completed. Please try again.");
          setLoading(false);
          setFlwTxRef(generateFlwTxRef());
        }
      },
      onClose: () => {
        setLoading(false);
        setFlwTxRef(generateFlwTxRef());
      },
    });
  }

  function handlePay() {
    if (isNigeriaGateway) {
      void handlePaystack();
    } else {
      handleFlutterwavePay();
    }
  }

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
      <Script src="https://js.paystack.co/v1/inline.js" strategy="beforeInteractive" />

      <div
        style={{
          background: "#111118",
          border: `1px solid ${isNigeriaGateway ? "rgba(16,185,129,0.25)" : "rgba(124,58,237,0.25)"}`,
          borderRadius: 20,
          padding: 0,
          maxWidth: 440,
          width: "100%",
          boxShadow: `0 0 80px ${isNigeriaGateway ? "rgba(16,185,129,0.08)" : "rgba(124,58,237,0.08)"}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: "#7C3AED",
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 900,
                color: "white",
              }}
            >
              LP
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#F2F1FF" }}>
              Lead<span style={{ color: "#A78BFA" }}>Pilot</span>
            </span>
          </div>

        </div>

        <div style={{ padding: "28px 24px" }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#F2F1FF",
              letterSpacing: -0.5,
              marginBottom: 6,
            }}
          >
            Get Lifetime Access
          </h1>

          <p
            style={{
              fontSize: 13,
              color: "#8888A8",
              marginBottom: 20,
              lineHeight: 1.6,
            }}
          >
            One payment of{" "}
            <strong style={{ color: "#F2F1FF" }}>
              {detecting
                ? "…"
                : isNigeriaGateway
                  ? "₦15,000"
                  : "$15 USD"}
            </strong>
            . No monthly fee. No renewal. Ever.
          </p>

          <div
            style={{
              background: "rgba(124,58,237,0.05)",
              border: "1px solid rgba(124,58,237,0.12)",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 20,
            }}
          >
            {[
              "1,000+ business contacts per search",
              "Direct phone numbers and WhatsApp numbers included",
              "Real contact emails pulled fresh from their website every search",
              "Unlimited CSV export — download and own your leads forever",
              "195 countries covered — any city, any niche, worldwide",
              "Lifetime updates included — every new feature ships to you free",
            ].map((f, i, arr) => (
              <div
                key={f}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 0",
                  fontSize: 13,
                  color: "#C0C0D8",
                  borderBottom:
                    i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}
              >
                <span style={{ color: "#10B981", fontWeight: 800, fontSize: 12 }}>✓</span>
                {f}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 14,
                color: "#555570",
                textDecoration: "line-through",
              }}
            >
              {isNigeriaGateway ? "₦30,000" : "$30"}
            </span>
            <span
              style={{
                fontSize: 36,
                fontWeight: 900,
                color: "#F2F1FF",
                letterSpacing: -1,
              }}
            >
              {detecting ? "…" : isNigeriaGateway ? "₦15,000" : "$15"}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#10B981",
                background: "rgba(16,185,129,0.08)",
                padding: "3px 10px",
                borderRadius: 100,
                border: "1px solid rgba(16,185,129,0.2)",
              }}
            >
              Lifetime
            </span>
          </div>

          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: "#8888A8",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Your email address
          </label>

          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePay()}
            style={{
              width: "100%",
              padding: "13px 16px",
              background: "#0A0A10",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              fontSize: 14,
              color: "#F2F1FF",
              fontFamily: "Inter, sans-serif",
              outline: "none",
              marginBottom: error ? 8 : 16,
              boxSizing: "border-box",
            }}
          />

          {error && (
            <p style={{ fontSize: 12, color: "#EF4444", marginBottom: 12 }}>{error}</p>
          )}

          <button
            type="button"
            onClick={handlePay}
            disabled={loading || detecting}
            style={{
              width: "100%",
              background: detecting
                ? "#1A1A24"
                : isNigeriaGateway
                  ? "#10B981"
                  : "#FF8200",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "16px",
              fontSize: 15,
              fontWeight: 800,
              cursor: loading || detecting ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif",
              boxShadow: detecting
                ? "none"
                : isNigeriaGateway
                  ? "0 0 40px rgba(16,185,129,0.3)"
                  : "0 0 40px rgba(255,130,0,0.25)",
              marginBottom: 14,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {detecting
              ? "Loading..."
              : loading
                ? "Opening payment..."
                : isNigeriaGateway
                  ? "🔒 Pay ₦15,000 — Get Access Now"
                  : "🔒 Pay $15 — Get Access Now"}
          </button>

          <p
            style={{
              fontSize: 11,
              color: "#444460",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            {isNigeriaGateway
              ? "🔒 Secured by Paystack · Instant access after payment"
              : "🔒 Secured by Flutterwave · Instant access after payment"}
          </p>
        </div>
      </div>
    </div>
  );
}
