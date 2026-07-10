"use client";

import { useEffect, useMemo, useState } from "react";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import { detectCountry } from "@/lib/geolocation";
import { SALE_PRICE_USD } from "@/constants/pricing";
import { getApiUrl } from "@/utils/env";

const FLW_PUBLIC_KEY = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ?? "";
const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const TIER_ONE = [
  { item: "1,000+ potential clients per search forever", price: "$60" },
  { item: "Direct phone numbers and verified emails", price: "$45" },
  { item: "The email sender built into the dashboard", price: "$50" },
  { item: "Unlimited CSV export of every search", price: "$25" },
];

const TIER_TWO = [
  "AI outreach writer that drafts every pitch.",
  "Done for you pitch templates by service.",
  "Open tracking and automatic follow ups.",
  "Search history and 195 countries.",
  "Every feature we add later at no extra charge.",
];

function generateFlwTxRef(): string {
  return `LT-FLW-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
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
    "https://www.leadthur.com";

  const flwConfig = useMemo(
    () => ({
      public_key: FLW_PUBLIC_KEY,
      tx_ref: flwTxRef,
      amount: SALE_PRICE_USD,
      currency: "USD",
      payment_options: "card",
      customer: {
        email: email || "customer@leadthur.com",
        name: email ? email.split("@")[0] : "Customer",
        phone_number: "",
      },
      customizations: {
        title: "LeadThur Lifetime Access",
        description: "One payment. Find clients forever.",
        logo: `${frontendUrl}/logo.png`,
      },
      meta: {
        ref_code: getRefCode() || "",
        product: "LeadThur Lifetime",
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

    const apiUrl = getApiUrl();
    if (!apiUrl) {
      setError("Checkout is not configured. Missing API URL.");
      return;
    }

    try {
      const refCode = getRefCode();
      const res = await fetch(`${apiUrl}/checkout/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, refCode }),
      });

      if (!res.ok) throw new Error("Failed to initialize payment");
      const data = (await res.json()) as { authorizationUrl?: string; authorization_url?: string };
      window.location.href = data.authorizationUrl || data.authorization_url || "";
    } catch {
      setError("Something went wrong. Please try again.");
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
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          background: "#111118",
          border: `1px solid ${isNigeriaGateway ? "rgba(16,185,129,0.25)" : "rgba(124,58,237,0.25)"}`,
          borderRadius: 20,
          padding: 0,
          maxWidth: 480,
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
              LT
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#F2F1FF" }}>
              Lead<span style={{ color: "#A78BFA" }}>Thur</span>
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
            Pay once. Find clients forever.
          </h1>

          <div
            style={{
              background: "rgba(124,58,237,0.05)",
              border: "1px solid rgba(124,58,237,0.12)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 16,
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 800, color: "#F2F1FF" }}>
              What you are getting
            </p>
            {TIER_ONE.map((row, i, arr) => (
              <div
                key={row.item}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "7px 0",
                  fontSize: 13,
                  color: "#C0C0D8",
                  borderBottom:
                    i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  flexWrap: "wrap",
                }}
              >
                <span>{row.item}</span>
                <span style={{ textDecoration: "line-through", color: "#7878A0" }}>{row.price}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "rgba(16,185,129,0.05)",
              border: "1px solid rgba(16,185,129,0.15)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 20,
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 800, color: "#10B981" }}>
              Included when you claim a slot today
            </p>
            {TIER_TWO.map((item, i, arr) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "7px 0",
                  fontSize: 13,
                  color: "#C0C0D8",
                  borderBottom:
                    i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}
              >
                <span>{item}</span>
                <span style={{ color: "#10B981", fontWeight: 800, flexShrink: 0 }}>FREE</span>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 14,
                color: "#7878A0",
                textDecoration: "line-through",
              }}
            >
              $300
            </p>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 14,
                color: "#7878A0",
                textDecoration: "line-through",
              }}
            >
              $100 per year
            </p>
            <span
              style={{
                fontSize: 36,
                fontWeight: 900,
                color: "#F2F1FF",
                letterSpacing: -1,
              }}
            >
              {detecting ? "…" : `$${SALE_PRICE_USD}`}
            </span>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#7878A0", fontWeight: 600 }}>
              Once. Never again.
            </p>
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
              minHeight: 48,
              padding: "13px 16px",
              background: "#0A0A10",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              fontSize: 14,
              color: "#F2F1FF",
              fontFamily: FONT,
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
              minHeight: 48,
              background: detecting
                ? "#1A1A24"
                : isNigeriaGateway
                  ? "#10B981"
                  : "#7C3AED",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "16px",
              fontSize: 15,
              fontWeight: 800,
              cursor: loading || detecting ? "not-allowed" : "pointer",
              fontFamily: FONT,
              boxShadow: detecting
                ? "none"
                : isNigeriaGateway
                  ? "0 0 40px rgba(16,185,129,0.3)"
                  : "0 0 40px rgba(124,58,237,0.35)",
              marginBottom: 14,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {detecting
              ? "Loading..."
              : loading
                ? "Opening payment..."
                : `Claim My Lifetime Access - $${SALE_PRICE_USD}`}
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
              ? "Secured by Paystack · Instant access after payment"
              : "Secured by Flutterwave · Instant access after payment"}
          </p>
        </div>
      </div>
    </div>
  );
}
