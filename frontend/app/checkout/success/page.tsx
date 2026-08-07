"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getApiUrl } from "@/utils/env";
import { fetchOutreachBalance } from "@/services/outreach-api";
import { PublicSuccessCard } from "@/components/public/public-success-card";
import { PublicFunnelShell } from "@/components/public/public-funnel-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/utils";

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
    <PublicSuccessCard
      title={checkoutKind === "outreach" ? "Outreach payment received." : "Payment successful."}
      description={statusText}
      descriptionClassName={cn(
        status === "error" && "text-[var(--lt-danger)]",
        status === "warn" && "text-[var(--lt-warning)]"
      )}
      detail={
        <>
          {checkoutKind === "outreach" && outreachDetail ? <p className="m-0">{outreachDetail}</p> : null}
          <p className="m-0">
            {checkoutKind === "outreach"
              ? "This purchase adds email outreach sends only. Search credits are separate and unchanged."
              : isFlutterwave
                ? "Flutterwave sends a payment receipt. LeadThur sends a separate email with your license key from "
                : "Paystack sends a payment receipt. LeadThur sends a separate email with your license key from "}
            {checkoutKind === "legacy" ? (
              <strong className="text-[var(--lt-accent-soft)]">access@leadthur.com</strong>
            ) : null}
            {checkoutKind === "legacy" ? "." : ""}
          </p>
        </>
      }
      reference={reference}
      primaryHref={checkoutKind === "outreach" ? "/dashboard/plans" : "/activate"}
      primaryLabel={
        checkoutKind === "outreach" ? "Back to Outreach Billing →" : "Activate My Account →"
      }
      secondaryHref={checkoutKind === "outreach" ? "/dashboard" : "/"}
      secondaryLabel={checkoutKind === "outreach" ? "Back to dashboard" : "Back to leadthur.com"}
    />
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <PublicFunnelShell
          showFooter={false}
          mainClassName="flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center py-10"
        >
          <div className="flex w-full flex-col items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </PublicFunnelShell>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
