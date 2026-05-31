"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiUrl } from "@/utils/env";
import { getLicenseHeaders } from "@/services/api";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MIN_PAYOUT_NGN } from "@/constants/pricing";

interface Commission {
  referred_email: string;
  created_at: string;
}

interface AffiliateStats {
  refCode: string;
  referralLink: string;
  totalReferrals: number;
  totalEarnedNgn: number;
  totalEarnedUsd: number;
  pendingNgn: number;
  pendingUsd: number;
  canRequestPayout: boolean;
  commissions: Commission[];
}

interface Bank {
  code: string;
  name: string;
}

const whatsappShareSvg = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const xShareSvg = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#1DA1F2" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export function AffiliateSection() {
  const isMobile = useIsMobile();
  const [affiliateStats, setAffiliateStats] = useState<AffiliateStats | null>(null);
  const [affiliateOpen, setAffiliateOpen] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [affiliateCopied, setAffiliateCopied] = useState(false);
  const [affiliateMsg, setAffiliateMsg] = useState("");

  const loadAffiliateStats = useCallback(async () => {
    try {
      const res = await fetch(`${getApiUrl()}/affiliate/stats`, {
        headers: getLicenseHeaders(),
      });
      if (res.ok) {
        const data = (await res.json()) as AffiliateStats;
        setAffiliateStats(data);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void loadAffiliateStats();
  }, [loadAffiliateStats]);

  useEffect(() => {
    async function loadBanks() {
      try {
        const res = await fetch(`${getApiUrl()}/affiliate/banks`);
        if (res.ok) {
          const data = (await res.json()) as { banks: Bank[] };
          setBanks(data.banks || []);
        }
      } catch {
        /* silent */
      }
    }
    void loadBanks();
  }, []);

  const resolveAccount = useCallback(async () => {
    if (!accountNumber || accountNumber.length < 10 || !selectedBank) return;

    setResolvingAccount(true);
    setResolvedName("");

    try {
      const res = await fetch(`${getApiUrl()}/affiliate/resolve-account`, {
        method: "POST",
        headers: {
          ...getLicenseHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountNumber,
          bankCode: selectedBank,
        }),
      });
      const data = (await res.json()) as { accountName?: string; error?: string };
      if (data.accountName) {
        setResolvedName(data.accountName);
      } else {
        setAffiliateMsg(data.error || "Could not resolve account. Check your details.");
      }
    } catch {
      setAffiliateMsg("Account resolution failed. Try again.");
    } finally {
      setResolvingAccount(false);
    }
  }, [accountNumber, selectedBank]);

  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      void resolveAccount();
    } else {
      setResolvedName("");
    }
  }, [accountNumber, selectedBank, resolveAccount]);

  async function saveBankDetails() {
    if (!resolvedName || !selectedBank || !accountNumber) return;

    setSavingBank(true);
    try {
      const bankObj = banks.find((b) => b.code === selectedBank);
      const res = await fetch(`${getApiUrl()}/affiliate/bank-details`, {
        method: "POST",
        headers: {
          ...getLicenseHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountNumber,
          bankCode: selectedBank,
          bankName: bankObj?.name || selectedBank,
          accountName: resolvedName,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        setAffiliateMsg("Bank details saved successfully.");
        setShowBankForm(false);
        await loadAffiliateStats();
      } else {
        setAffiliateMsg(data.error || "Failed to save bank details.");
      }
    } catch {
      setAffiliateMsg("Failed to save bank details.");
    } finally {
      setSavingBank(false);
    }
  }

  async function requestPayout() {
    if (!affiliateStats?.canRequestPayout) return;

    setPayoutLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/affiliate/request-payout`, {
        method: "POST",
        headers: getLicenseHeaders(),
      });
      const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
      if (data.success) {
        setAffiliateMsg(data.message || "Payout request submitted.");
        await loadAffiliateStats();
      } else {
        setAffiliateMsg(data.error || "Failed to submit payout request.");
      }
    } catch {
      setAffiliateMsg("Failed to submit payout request.");
    } finally {
      setPayoutLoading(false);
    }
  }

  if (!affiliateStats) return null;

  const msgIsError =
    affiliateMsg.toLowerCase().includes("failed") ||
    affiliateMsg.toLowerCase().includes("error");

  const whatsappText = encodeURIComponent(
    `I have been using LeadThur to find business clients and it actually works. You can find 1,000+ business contacts in any city in 60 seconds. Try it free here: ${affiliateStats.referralLink}`
  );

  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(16,185,129,0.05) 100%)",
        border: "1px solid rgba(124,58,237,0.2)",
        borderRadius: 16,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setAffiliateOpen(!affiliateOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setAffiliateOpen(!affiliateOpen);
          }
        }}
        style={{
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          background: affiliateOpen ? "rgba(124,58,237,0.06)" : "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>💰</span>
          <div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#F2F1FF" }}>
              Affiliate Programme
            </span>
            {affiliateStats.totalReferrals === 0 ? (
              <span
                style={{
                  fontSize: 11,
                  color: "#A78BFA",
                  marginLeft: 8,
                  fontWeight: 600,
                }}
              >
                Earn $7.50 per referral
              </span>
            ) : (
              <span
                style={{
                  fontSize: 11,
                  color: "#10B981",
                  marginLeft: 8,
                  fontWeight: 700,
                }}
              >
                {affiliateStats.totalReferrals} referral
                {affiliateStats.totalReferrals !== 1 ? "s" : ""} · $
                {affiliateStats.totalEarnedUsd.toFixed(2)} earned
              </span>
            )}
          </div>
        </div>
        <span
          style={{
            color: "#8888A8",
            fontSize: 16,
            transform: affiliateOpen ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 0.2s",
            display: "inline-block",
          }}
        >
          ⌄
        </span>
      </div>

      {affiliateOpen && (
        <div style={{ padding: "0 20px 24px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginBottom: 20,
              marginTop: 16,
            }}
          >
            {[
              {
                value: affiliateStats.totalReferrals,
                label: "Referrals",
                color: "#A78BFA",
                icon: "👥",
              },
              {
                value: `$${affiliateStats.totalEarnedUsd.toFixed(2)}`,
                label: "Total Earned",
                color: "#10B981",
                icon: "💵",
                sub: `₦${affiliateStats.totalEarnedNgn.toLocaleString()}`,
              },
              {
                value: `$${affiliateStats.pendingUsd.toFixed(2)}`,
                label: "Pending",
                color:
                  affiliateStats.pendingNgn >= MIN_PAYOUT_NGN ? "#FBBF24" : "#8888A8",
                icon: affiliateStats.pendingNgn >= MIN_PAYOUT_NGN ? "🔥" : "⏳",
                sub: `₦${affiliateStats.pendingNgn.toLocaleString()}`,
              },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  background: "#111118",
                  border: `1px solid ${s.color}20`,
                  borderRadius: 12,
                  padding: "14px 10px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
                <div
                  style={{
                    fontSize: isMobile ? 16 : 20,
                    fontWeight: 900,
                    color: s.color,
                    marginBottom: 2,
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: -0.5,
                  }}
                >
                  {s.value}
                </div>
                {s.sub && (
                  <div style={{ fontSize: 9, color: "#7878A0", marginBottom: 2 }}>{s.sub}</div>
                )}
                <div style={{ fontSize: 10, color: "#7878A0" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {affiliateStats.canRequestPayout && (
            <div
              style={{
                background: "rgba(251,191,36,0.08)",
                border: "1px solid rgba(251,191,36,0.2)",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <p style={{ fontSize: 13, color: "#FBBF24", fontWeight: 600, margin: 0 }}>
                🎉 You have ₦{affiliateStats.pendingNgn.toLocaleString()} ready to withdraw
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void requestPayout();
                }}
                disabled={payoutLoading}
                style={{
                  background: "#FBBF24",
                  color: "#111111",
                  border: "none",
                  borderRadius: 7,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: payoutLoading ? "not-allowed" : "pointer",
                  fontFamily: "Inter, sans-serif",
                  flexShrink: 0,
                  opacity: payoutLoading ? 0.7 : 1,
                }}
              >
                {payoutLoading ? "Requesting..." : "Request Payout"}
              </button>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#8888A8",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Your referral link
            </p>

            <div
              style={{
                background: "#111118",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12,
                color: "#A78BFA",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: 10,
                fontFamily: "monospace",
              }}
            >
              {affiliateStats.referralLink}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  await navigator.clipboard.writeText(affiliateStats.referralLink);
                  setAffiliateCopied(true);
                  setTimeout(() => setAffiliateCopied(false), 2000);
                }}
                style={{
                  background: affiliateCopied
                    ? "rgba(16,185,129,0.15)"
                    : "rgba(255,255,255,0.05)",
                  border: `1px solid ${affiliateCopied ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
                  color: affiliateCopied ? "#10B981" : "#F2F1FF",
                  padding: "11px 8px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {affiliateCopied ? "✓" : "📋"} {affiliateCopied ? "Copied" : "Copy"}
              </button>

              <a
                href={`https://wa.me/?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "rgba(37,211,102,0.1)",
                  border: "1px solid rgba(37,211,102,0.25)",
                  color: "#25D366",
                  padding: "11px 8px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.2s",
                }}
              >
                {whatsappShareSvg}
                WhatsApp
              </a>

              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("This tool finds business contacts in 60 seconds. Any city, any niche, worldwide. Try it free 👇")}&url=${encodeURIComponent(affiliateStats.referralLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "rgba(29,161,242,0.1)",
                  border: "1px solid rgba(29,161,242,0.25)",
                  color: "#1DA1F2",
                  padding: "11px 8px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.2s",
                }}
              >
                {xShareSvg}
                Post on X
              </a>
            </div>

            <p style={{ fontSize: 11, color: "#7878A0", marginTop: 8, lineHeight: 1.5 }}>
              Share anywhere. Earn $7.50 (₦7,500) for every person who buys through your link. No
              cap.
            </p>
          </div>

          {!showBankForm ? (
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBankForm(true);
                }}
                style={{
                  background: "transparent",
                  color:
                    affiliateStats.pendingNgn >= MIN_PAYOUT_NGN ? "#FBBF24" : "#8888A8",
                  border: `1px solid ${
                    affiliateStats.pendingNgn >= MIN_PAYOUT_NGN
                      ? "rgba(251,191,36,0.3)"
                      : "rgba(255,255,255,0.08)"
                  }`,
                  borderRadius: 8,
                  padding: "9px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                🏦{" "}
                {affiliateStats.pendingNgn >= MIN_PAYOUT_NGN
                  ? "Add bank details to withdraw"
                  : "Add bank details for payout"}
              </button>
            </div>
          ) : (
            <div
              style={{
                background: "#111118",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 700, color: "#F2F1FF", margin: 0 }}>
                  Bank Details for Payout
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBankForm(false);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#7878A0",
                    fontSize: 18,
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label="Close bank form"
                >
                  ×
                </button>
              </div>

              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "#0A0A10",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  color: "#F2F1FF",
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                  marginBottom: 10,
                  outline: "none",
                }}
              >
                <option value="">Select your bank</option>
                {banks.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Account number (10 digits)"
                value={accountNumber}
                onChange={(e) =>
                  setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "#0A0A10",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  color: "#F2F1FF",
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                  marginBottom: 10,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              {resolvingAccount && (
                <p style={{ fontSize: 12, color: "#8888A8", marginBottom: 10 }}>
                  Verifying account...
                </p>
              )}

              {resolvedName && (
                <div
                  style={{
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 12,
                    fontSize: 13,
                    color: "#10B981",
                    fontWeight: 600,
                  }}
                >
                  ✓ {resolvedName}
                </div>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void saveBankDetails();
                }}
                disabled={!resolvedName || savingBank}
                style={{
                  width: "100%",
                  background: resolvedName ? "#7C3AED" : "#1A1A24",
                  color: resolvedName ? "white" : "#7878A0",
                  border: "none",
                  borderRadius: 8,
                  padding: "13px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: resolvedName && !savingBank ? "pointer" : "not-allowed",
                  fontFamily: "Inter, sans-serif",
                  transition: "all 0.2s",
                }}
              >
                {savingBank ? "Saving..." : "Save Bank Details"}
              </button>
            </div>
          )}

          {affiliateMsg && (
            <div
              style={{
                marginTop: 12,
                padding: "11px 14px",
                background: msgIsError
                  ? "rgba(239,68,68,0.08)"
                  : "rgba(16,185,129,0.08)",
                border: `1px solid ${msgIsError ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
                borderRadius: 8,
                fontSize: 13,
                color: msgIsError ? "#EF4444" : "#10B981",
                fontWeight: 600,
              }}
            >
              {affiliateMsg}
            </div>
          )}

          {affiliateStats.commissions.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#8888A8",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                }}
              >
                Recent Referrals
              </p>
              {affiliateStats.commissions.slice(0, 5).map((c, i) => (
                <div
                  key={`${c.referred_email}-${i}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom:
                      i < Math.min(affiliateStats.commissions.length, 5) - 1
                        ? "1px solid rgba(255,255,255,0.05)"
                        : "none",
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        background: "rgba(16,185,129,0.1)",
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                      }}
                    >
                      🎉
                    </div>
                    <span style={{ color: "#8888A8" }}>
                      {c.referred_email.replace(/(.{3}).*(@.*)/, "$1***$2")}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#10B981", fontWeight: 800, fontSize: 13 }}>
                      +$7.50
                    </div>
                    <div style={{ color: "#7878A0", fontSize: 10 }}>
                      {new Date(c.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {affiliateStats.totalReferrals === 0 && (
            <div
              style={{
                marginTop: 16,
                padding: 20,
                background: "rgba(124,58,237,0.05)",
                border: "1px solid rgba(124,58,237,0.12)",
                borderRadius: 12,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>🚀</div>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#F2F1FF",
                  marginBottom: 6,
                }}
              >
                Share your link and start earning
              </p>
              <p style={{ fontSize: 12, color: "#8888A8", lineHeight: 1.6, margin: 0 }}>
                Every person who buys LeadPilot through your link earns you $7.50. Share on
                WhatsApp, Twitter, or anywhere your audience is.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
