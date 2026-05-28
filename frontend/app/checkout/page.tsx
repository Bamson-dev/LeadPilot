"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { closePaymentModal, useFlutterwave } from "flutterwave-react-v3";

async function detectCountry(): Promise<string> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      cache: "no-store",
    });
    const data = (await res.json()) as { country_code?: string };
    return data.country_code || "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

export default function CheckoutPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [gatewayReady, setGatewayReady] = useState(false);
  const isNigeria = gatewayReady ? country === "NG" : true;

  useEffect(() => {
    detectCountry().then((code) => {
      setCountry(code);
      setDetecting(false);
      setGatewayReady(true);
    });
  }, []);

  function getRefCode(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("lp_ref_code");
  }

  function getFlwConfig() {
    return {
      public_key: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ?? "",
      tx_ref: `LP-FLW-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      amount: 15,
      currency: "USD",
      payment_options: "card",
      customer: {
        email: email,
        name: email.split("@")[0] || "Customer",
        phone_number: "",
      },
      customizations: {
        title: "LeadPilot Lifetime Access",
        description: "One payment. Find clients forever.",
        logo: "https://www.leadpilot.live/logo.png",
      },
      meta: {
        ref_code: getRefCode() || "",
        product: "LeadPilot Lifetime",
        gateway: "flutterwave",
      },
    };
  }

  const handleFlutterwave = useFlutterwave(getFlwConfig());

  async function handlePaystack() {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const refCode = getRefCode();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/checkout/initialize`, {
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

    setError("");
    setLoading(true);

    handleFlutterwave({
      callback: (response) => {
        closePaymentModal();
        if (response.status === "successful") {
          window.location.href = `/checkout/success?reference=${response.transaction_id}&gateway=flutterwave`;
        } else {
          setError("Payment was not completed. Please try again.");
          setLoading(false);
        }
      },
      onClose: () => setLoading(false),
    });
  }

  function handlePay() {
    if (isNigeria) {
      void handlePaystack();
    } else {
      handleFlutterwavePay();
    }
  }

  return (
    <>
      {gatewayReady && isNigeria && (
        <Script src="https://js.paystack.co/v1/inline.js" strategy="afterInteractive" />
      )}

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
            border: "1px solid rgba(124,58,237,0.3)",
            borderRadius: 20,
            padding: "40px 32px",
            maxWidth: 440,
            width: "100%",
            boxShadow: "0 0 80px rgba(124,58,237,0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                background: "#7C3AED",
                borderRadius: 9,
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 800,
                color: "white",
              }}
            >
              LP
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#F2F1FF" }}>
              Lead<span style={{ color: "#A78BFA" }}>Pilot</span>
            </span>
          </div>

          <h1
            style={{
              fontSize: 24,
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
              fontSize: 14,
              color: "#8888A8",
              marginBottom: 28,
              lineHeight: 1.6,
            }}
          >
            One payment of{" "}
            <strong style={{ color: "#F2F1FF" }}>
              {isNigeria ? "₦15,000" : "$15"}
            </strong>
            . No monthly fee. No renewal. Ever.
          </p>

          <div
            style={{
              background: "rgba(124,58,237,0.06)",
              border: "1px solid rgba(124,58,237,0.2)",
              borderRadius: 12,
              padding: "14px 16px",
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
                  padding: "6px 0",
                  fontSize: 13,
                  color: "#C0C0D8",
                  borderBottom:
                    i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}
              >
                <span style={{ color: "#10B981", fontWeight: 700 }}>✓</span>
                {f}
              </div>
            ))}
          </div>

          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#8888A8",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
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
              padding: "14px 16px",
              background: "#0A0A10",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              fontSize: 15,
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
            onClick={isNigeria ? handlePaystack : handleFlutterwavePay}
            disabled={loading || detecting || !gatewayReady}
            style={{
              width: "100%",
              background: !gatewayReady || detecting ? "#1A1A24" : isNigeria ? "#10B981" : "#FF8200",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "16px",
              fontSize: 15,
              fontWeight: 800,
              cursor: loading || detecting || !gatewayReady ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif",
              boxShadow: !gatewayReady || detecting
                ? "none"
                : isNigeria
                  ? "0 0 40px rgba(16,185,129,0.3)"
                  : "0 0 40px rgba(255,130,0,0.25)",
              marginBottom: 14,
              transition: "all 0.2s",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {!gatewayReady || detecting
              ? "Loading..."
              : loading
                ? "Opening payment..."
                : isNigeria
                  ? "🔒 Pay ₦15,000 — Get Access Now"
                  : "🔒 Pay $15 — Get Access Now"}
          </button>

          <p
            style={{
              fontSize: 12,
              color: "#7878A0",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            🔒 Secure payment · Instant access after payment
          </p>
        </div>
      </div>
    </>
  );
}
