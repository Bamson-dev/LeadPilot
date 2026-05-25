"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiUrl } from "@/utils/env";
import { getLicenseHeaders } from "@/services/api";

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

export function AffiliateSection() {
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

  return (
    <div
      style={{
        background: "#0F0F18",
        border: "1px solid rgba(16,185,129,0.15)",
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
        }}
      >
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#F2F1FF" }}>
            🤝 Affiliate Programme
          </span>
          <span
            style={{
              fontSize: 12,
              color: "#10B981",
              marginLeft: 10,
              fontWeight: 600,
            }}
          >
            {affiliateStats.totalReferrals} referral
            {affiliateStats.totalReferrals !== 1 ? "s" : ""} · $
            {affiliateStats.totalEarnedUsd.toFixed(2)} earned
          </span>
        </div>
        <span
          style={{
            color: "#7878A0",
            fontSize: 16,
            transform: affiliateOpen ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 0.2s",
          }}
        >
          ⌄
        </span>
      </div>

      {affiliateOpen && (
        <div style={{ padding: "0 20px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              margin: "16px 0",
            }}
          >
            {[
              { label: "Total Referrals", value: String(affiliateStats.totalReferrals) },
              {
                label: "Total Earned",
                value: `$${affiliateStats.totalEarnedUsd.toFixed(2)}`,
              },
              {
                label: "Pending Payout",
                value: `$${affiliateStats.pendingUsd.toFixed(2)}`,
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "#111118",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 10,
                  padding: "12px 10px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#10B981",
                    marginBottom: 3,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: 10, color: "#7878A0" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#8888A8",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Your referral link
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div
                style={{
                  flex: 1,
                  background: "#111118",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 12,
                  color: "#A78BFA",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {affiliateStats.referralLink}
              </div>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(affiliateStats.referralLink);
                  setAffiliateCopied(true);
                  setTimeout(() => setAffiliateCopied(false), 2000);
                }}
                style={{
                  background: affiliateCopied
                    ? "rgba(16,185,129,0.15)"
                    : "rgba(124,58,237,0.15)",
                  border: `1px solid ${affiliateCopied ? "rgba(16,185,129,0.3)" : "rgba(124,58,237,0.3)"}`,
                  color: affiliateCopied ? "#10B981" : "#A78BFA",
                  padding: "10px 16px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}
              >
                {affiliateCopied ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#7878A0", marginTop: 6 }}>
              Share this link. Earn $7.50 (₦7,500) for every person who buys through it.
            </p>
          </div>

          {!showBankForm ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {affiliateStats.canRequestPayout && (
                <button
                  type="button"
                  onClick={() => void requestPayout()}
                  disabled={payoutLoading}
                  style={{
                    background: "#10B981",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: payoutLoading ? "not-allowed" : "pointer",
                    fontFamily: "Inter, sans-serif",
                    opacity: payoutLoading ? 0.7 : 1,
                  }}
                >
                  {payoutLoading
                    ? "Requesting..."
                    : `Request Payout — ₦${affiliateStats.pendingNgn.toLocaleString()}`}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowBankForm(true)}
                style={{
                  background: "transparent",
                  color: "#8888A8",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {affiliateStats.pendingNgn > 0 ? "Update bank details" : "Add bank details"}
              </button>
            </div>
          ) : (
            <div
              style={{
                background: "#111118",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#F2F1FF",
                  marginBottom: 14,
                }}
              >
                Bank Details for Payout
              </p>

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

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void saveBankDetails()}
                  disabled={!resolvedName || savingBank}
                  style={{
                    flex: 1,
                    background: resolvedName ? "#7C3AED" : "#333",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "12px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: resolvedName && !savingBank ? "pointer" : "not-allowed",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {savingBank ? "Saving..." : "Save Bank Details"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBankForm(false)}
                  style={{
                    background: "transparent",
                    color: "#7878A0",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {affiliateMsg && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: 8,
                fontSize: 13,
                color: "#10B981",
                fontWeight: 600,
              }}
            >
              {affiliateMsg}
            </div>
          )}

          {affiliateStats.commissions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#8888A8",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
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
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    fontSize: 13,
                    gap: 8,
                  }}
                >
                  <span style={{ color: "#8888A8", flex: 1, minWidth: 0 }}>
                    {c.referred_email.replace(/(.{3}).*(@.*)/, "$1***$2")}
                  </span>
                  <span style={{ color: "#10B981", fontWeight: 700 }}>+$7.50</span>
                  <span style={{ color: "#7878A0", fontSize: 11, flexShrink: 0 }}>
                    {new Date(c.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
