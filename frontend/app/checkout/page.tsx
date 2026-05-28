"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

export default function CheckoutPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNigeria, setIsNigeria] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const detectCountry = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
        const data = (await res.json()) as { country_code?: string };
        if (!cancelled) setIsNigeria(data.country_code === "NG");
      } catch {
        if (!cancelled) setIsNigeria(false);
      }
    };
    void detectCountry();
    return () => {
      cancelled = true;
    };
  }, []);

  function getRefCode(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("lp_ref_code");
  }

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

  return (
    <>
      {isNigeria && (
        <Script src="https://js.paystack.co/v1/inline.js" strategy="beforeInteractive" />
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
            One payment of <strong style={{ color: "#F2F1FF" }}>$15 (₦15,000)</strong>. No
            monthly fee. No renewal. Ever.
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
            onKeyDown={(e) => e.key === "Enter" && void handlePaystack()}
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
            onClick={() => void handlePaystack()}
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? "#4C1D95" : "#7C3AED",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "16px",
              fontSize: 15,
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 0 40px rgba(124,58,237,0.35)",
              marginBottom: 14,
              transition: "background 0.2s",
            }}
          >
            {loading ? "Opening payment..." : "Pay $15 (₦15,000) — Get Access Now"}
          </button>

          <p
            style={{
              fontSize: 12,
              color: "#7878A0",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            🔒 Secure payment via Paystack · Instant access after payment
          </p>
        </div>
      </div>
    </>
  );
}
