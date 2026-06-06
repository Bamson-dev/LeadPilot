"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { closePaymentModal, useFlutterwave } from "flutterwave-react-v3";
import { detectCountry } from "@/lib/geolocation";
import { getLicenseHeaders } from "@/services/api";
import { getApiUrl } from "@/utils/env";

const FLW_PUBLIC_KEY = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ?? "";

interface TopUpTier {
  id: string;
  credits: number;
  searches: number;
  amountNgn: number;
  amountUsd: number;
  label: string;
  popular?: boolean;
}

const TIERS: TopUpTier[] = [
  {
    id: "topup_300",
    credits: 300,
    searches: 100,
    amountNgn: 15000,
    amountUsd: 15,
    label: "Starter Top Up",
  },
  {
    id: "topup_750",
    credits: 750,
    searches: 250,
    amountNgn: 25000,
    amountUsd: 25,
    label: "Growth Top Up",
    popular: true,
  },
  {
    id: "topup_1200",
    credits: 1200,
    searches: 400,
    amountNgn: 40000,
    amountUsd: 40,
    label: "Pro Top Up",
  },
  {
    id: "topup_2100",
    credits: 2100,
    searches: 700,
    amountNgn: 60000,
    amountUsd: 60,
    label: "Agency Top Up",
  },
];

interface FlwPaymentInit {
  reference: string;
  amount: number;
  tier: TopUpTier;
  licenseId: string;
  amountNgn: number;
}

interface SearchLimitModalProps {
  email: string;
  onClose: () => void;
}

export default function SearchLimitModal({ email, onClose }: SearchLimitModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [flwPayment, setFlwPayment] = useState<FlwPaymentInit | null>(null);
  const flwTriggeredRef = useRef(false);

  const isNigeria = country === "NG";
  const gatewayReady = !detecting;

  const frontendUrl =
    process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "https://www.leadthur.com");

  useEffect(() => {
    detectCountry().then((code) => {
      setCountry(code);
      setDetecting(false);
    });
  }, []);

  const flwConfig = useMemo(
    () => ({
      public_key: FLW_PUBLIC_KEY,
      tx_ref: flwPayment?.reference ?? `topup-pending-${Date.now()}`,
      amount: flwPayment?.amount ?? 1,
      currency: "USD" as const,
      payment_options: "card",
      customer: {
        email: email || "customer@leadthur.com",
        name: email ? email.split("@")[0] : "Customer",
        phone_number: "",
      },
      customizations: {
        title: "LeadThur Search Top Up",
        description: flwPayment
          ? `${flwPayment.tier.label} — ${flwPayment.tier.searches} extra searches`
          : "Search Top Up",
        logo: `${frontendUrl}/logo.png`,
      },
      meta: {
        type: "topup",
        tierId: flwPayment?.tier.id ?? "",
        credits: flwPayment?.tier.credits ?? 0,
        licenseId: flwPayment?.licenseId ?? "",
        amountNgn: flwPayment?.amountNgn ?? 0,
        email,
      },
    }),
    [email, flwPayment, frontendUrl]
  );

  const handleFlutterwave = useFlutterwave(flwConfig);

  useEffect(() => {
    if (!flwPayment || isNigeria || flwTriggeredRef.current) return;

    if (!FLW_PUBLIC_KEY) {
      setError("Payment is not configured");
      setLoading(null);
      setFlwPayment(null);
      return;
    }

    flwTriggeredRef.current = true;

    handleFlutterwave({
      callback: (response) => {
        closePaymentModal();
        flwTriggeredRef.current = false;
        if (response.status === "successful") {
          window.location.href = "/dashboard?topup=success";
        } else {
          setError("Payment was not completed. Please try again.");
          setLoading(null);
          setFlwPayment(null);
        }
      },
      onClose: () => {
        flwTriggeredRef.current = false;
        setLoading(null);
        setFlwPayment(null);
      },
    });
  }, [flwPayment, isNigeria, handleFlutterwave]);

  async function handleTopUp(tier: TopUpTier) {
    setLoading(tier.id);
    setError("");

    const apiUrl = getApiUrl();
    if (!apiUrl) {
      setError("API URL not configured.");
      setLoading(null);
      return;
    }

    try {
      if (isNigeria) {
        const res = await fetch(`${apiUrl}/topup/initialize`, {
          method: "POST",
          headers: getLicenseHeaders(),
          body: JSON.stringify({ email, tierId: tier.id }),
        });

        const data = (await res.json()) as {
          success?: boolean;
          authorizationUrl?: string;
          error?: string;
        };

        if (data.success && data.authorizationUrl) {
          window.location.href = data.authorizationUrl;
        } else {
          setError(data.error || "Failed to initialize payment. Try again.");
          setLoading(null);
        }
        return;
      }

      if (!FLW_PUBLIC_KEY) {
        setError("Payment is not configured");
        setLoading(null);
        return;
      }

      const res = await fetch(`${apiUrl}/topup/initialize-flw`, {
        method: "POST",
        headers: getLicenseHeaders(),
        body: JSON.stringify({ email, tierId: tier.id }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        reference?: string;
        amount?: number;
        licenseId?: string;
        amountNgn?: number;
        error?: string;
      };

      if (data.success && data.reference && data.amount != null && data.licenseId) {
        flwTriggeredRef.current = false;
        setFlwPayment({
          reference: data.reference,
          amount: data.amount,
          tier,
          licenseId: data.licenseId,
          amountNgn: data.amountNgn ?? tier.amountNgn,
        });
      } else {
        setError(data.error || "Failed to initialize payment. Try again.");
        setLoading(null);
      }
    } catch {
      setError("Failed to connect. Check your internet connection.");
      setLoading(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#111118",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: 32,
          maxWidth: 520,
          width: "100%",
          position: "relative",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#8888A8",
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
          }}
        >
          ✕
        </button>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#F2F1FF",
              margin: "0 0 10px",
              letterSpacing: -0.5,
              lineHeight: 1.25,
            }}
          >
            You have used all your free searches
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#8888A8",
              margin: "0 0 14px",
              lineHeight: 1.65,
              maxWidth: 400,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Your 100 free monthly searches are used up. Top up below to keep searching and
            discovering new leads instantly.
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(124,58,237,0.1)",
              border: "1px solid rgba(124,58,237,0.25)",
              borderRadius: 100,
              padding: "5px 12px",
              fontSize: 11,
              color: "#C4B5FD",
              fontWeight: 600,
            }}
          >
            Credits are added to your account immediately after payment
          </div>
        </div>

        {!gatewayReady && (
          <div
            style={{
              textAlign: "center",
              padding: "20px 0",
              fontSize: 13,
              color: "#555570",
            }}
          >
            Detecting your location...
          </div>
        )}

        {gatewayReady && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                style={{
                  background: tier.popular ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${tier.popular ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  position: "relative",
                  gap: 12,
                }}
              >
                {tier.popular && (
                  <div
                    style={{
                      position: "absolute",
                      top: -10,
                      left: 16,
                      background: "linear-gradient(90deg, #7C3AED, #A78BFA)",
                      color: "white",
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 100,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Best Value
                  </div>
                )}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F2F1FF", marginBottom: 4 }}>
                    {tier.label}
                  </div>
                  <div
                    style={{ fontSize: 13, color: "#A78BFA", fontWeight: 600, marginBottom: 2 }}
                  >
                    +{tier.searches.toLocaleString()} extra searches
                  </div>
                  <div style={{ fontSize: 12, color: "#8888A8" }}>
                    {tier.credits.toLocaleString()} credits included
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#F2F1FF" }}>
                    {isNigeria
                      ? `₦${tier.amountNgn.toLocaleString()}`
                      : `$${tier.amountUsd}`}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleTopUp(tier)}
                    disabled={loading === tier.id}
                    style={{
                      background: tier.popular ? "#7C3AED" : "rgba(124,58,237,0.15)",
                      border: `1px solid ${tier.popular ? "#7C3AED" : "rgba(124,58,237,0.3)"}`,
                      borderRadius: 8,
                      padding: "7px 18px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "white",
                      cursor: loading === tier.id ? "not-allowed" : "pointer",
                      fontFamily: "Inter, sans-serif",
                      opacity: loading === tier.id ? 0.7 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {loading === tier.id ? "Loading..." : "Top Up Now"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#EF4444",
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {gatewayReady && (
          <p
            style={{
              fontSize: 11,
              color: "#555570",
              textAlign: "center",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {isNigeria
              ? "Secure checkout via Paystack. Pick a plan, pay once, and continue searching right away."
              : "Secure checkout via Flutterwave. Pick a plan, pay once, and continue searching right away."}
          </p>
        )}
      </div>
    </div>
  );
}
