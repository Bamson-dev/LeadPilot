"use client";

import { useEffect, useMemo, useState } from "react";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import { detectCountry } from "@/lib/geolocation";
import { SALE_PRICE_USD } from "@/constants/pricing";
import { getApiUrl } from "@/utils/env";
import {
  CheckoutTierOnePanel,
  CheckoutTierTwoPanel,
} from "@/components/public/checkout-value-list";
import { PublicFunnelShell } from "@/components/public/public-funnel-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelContent } from "@/components/ui/panel";
import { cn } from "@/utils/utils";

const FLW_PUBLIC_KEY = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ?? "";

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
    <PublicFunnelShell
      showFooter={false}
      mainClassName="flex min-h-[calc(100vh-4rem)] max-w-lg items-center justify-center py-10 md:py-12"
    >
      <Panel
        className={cn(
          "w-full overflow-hidden shadow-xl",
          isNigeriaGateway
            ? "border-[var(--lt-success)]/25 shadow-[var(--lt-success)]/10"
            : "border-[var(--lt-accent)]/25 shadow-[var(--lt-accent)]/10"
        )}
      >
        <PanelContent className="space-y-5 p-6 md:p-7">
          <div>
            <h1 className="m-0 text-xl font-black tracking-tight text-[var(--lt-text)] md:text-2xl">
              Pay once. Find clients forever.
            </h1>
          </div>

          <CheckoutTierOnePanel items={TIER_ONE} />
          <CheckoutTierTwoPanel items={TIER_TWO} />

          <div className="text-center">
            <p className="m-0 mb-1 text-sm text-[var(--lt-text-subtle)] line-through">$300</p>
            <p className="m-0 mb-2 text-sm text-[var(--lt-text-subtle)] line-through">
              $100 per year
            </p>
            <p className="m-0 text-4xl font-black text-[var(--lt-text)]">
              {detecting ? "…" : `$${SALE_PRICE_USD}`}
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--lt-text-muted)]">
              Once. Never again.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[var(--lt-text-subtle)]">
              Your email address
            </label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePay()}
              className="min-h-12"
            />
          </div>

          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="button"
            size="lg"
            className={cn(
              "h-12 w-full text-base font-extrabold",
              isNigeriaGateway && "bg-[var(--lt-success)] hover:bg-[var(--lt-success)]/90"
            )}
            onClick={handlePay}
            disabled={loading || detecting}
          >
            {detecting
              ? "Loading..."
              : loading
                ? "Opening payment..."
                : `Claim My Lifetime Access - $${SALE_PRICE_USD}`}
          </Button>

          <p className="m-0 text-center text-[11px] leading-relaxed text-[var(--lt-text-subtle)]">
            {isNigeriaGateway
              ? "Secured by Paystack · Instant access after payment"
              : "Secured by Flutterwave · Instant access after payment"}
          </p>
        </PanelContent>
      </Panel>
    </PublicFunnelShell>
  );
}
