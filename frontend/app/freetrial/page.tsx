"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { BusinessLead } from "@leadthur/shared";
import { getApiUrl } from "@/utils/env";
import { SALE_PRICE_NGN } from "@/constants/pricing";

const MAX_TRIAL_LEADS = 15;
const PAYSTACK_URL = "https://paystack.shop/pay/Leadthur";
const SITE_URL = "https://www.leadthur.com";
const TRIAL_EMAIL_KEY = "lp_trial_email";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TrialStatus = "idle" | "searching" | "complete" | "limit";

interface TrialLead {
  id: string;
  business_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  verifiedEmails: string[];
  emails: string[];
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
}

interface TrialAggregateStats {
  totalFound: number;
  verifiedEmailCount: number;
  emailableCount: number;
}

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const LOCKED_FIELD_STYLE: CSSProperties = {
  filter: "blur(5px)",
  userSelect: "none",
  fontSize: 12,
  color: "#C0C0D8",
  background: "rgba(124,58,237,0.08)",
  padding: "2px 8px",
  borderRadius: 4,
};

function getTrialEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TRIAL_EMAIL_KEY) || "";
}

function setTrialEmail(email: string): void {
  localStorage.setItem(TRIAL_EMAIL_KEY, email);
}

async function recordSearchUsed(email: string): Promise<void> {
  const apiUrl = getApiUrl();
  if (!apiUrl || !email) return;
  try {
    await fetch(`${apiUrl}/trial/search-used`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    /* non-blocking */
  }
}

function getVisitorId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem("lp_visitor_id");
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("lp_visitor_id", id);
  }
  return id;
}

function getTrialCount(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem("lp_trial_count") || "0", 10);
}

function incrementTrialCount(): void {
  const current = getTrialCount();
  localStorage.setItem("lp_trial_count", String(current + 1));
}

function normalizeLead(raw: BusinessLead): TrialLead {
  const verifiedEmails = raw.verifiedEmails?.length
    ? [...raw.verifiedEmails]
    : [];
  const emails =
    raw.emails?.length > 0
      ? [...raw.emails]
      : raw.email
        ? raw.email.split(/,\s*/).filter(Boolean)
        : [];
  return {
    id: raw.id,
    business_name: raw.name,
    address: raw.address || null,
    phone: raw.phone,
    email: verifiedEmails[0] ?? emails[0] ?? raw.email,
    verifiedEmails,
    emails,
    website: raw.website,
    rating: raw.rating,
    reviews_count: raw.reviewCount,
  };
}

function countEmailableInLeads(leads: TrialLead[]): number {
  return leads.filter(
    (lead) =>
      lead.verifiedEmails.length > 0 ||
      lead.emails.length > 0 ||
      Boolean(lead.email?.trim())
  ).length;
}

function generatePlaceholderEmail(businessName: string): string {
  const domain = businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(" ")
    .slice(0, 2)
    .join("");
  return `info@${domain || "business"}.com`;
}

function truncateAddress(address: string, maxLen: number): string {
  if (address.length <= maxLen) return address;
  return `${address.slice(0, maxLen)}…`;
}

async function fetchSearchStats(searchId: string): Promise<TrialAggregateStats> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return { totalFound: 0, verifiedEmailCount: 0, emailableCount: 0 };

  try {
    const res = await fetch(`${apiUrl}/search/results/${searchId}?limit=1000`);
    if (!res.ok) return { totalFound: 0, verifiedEmailCount: 0, emailableCount: 0 };
    const data = (await res.json()) as {
      totalFound?: number;
      total?: number;
      leads?: BusinessLead[];
    };
    const leads = data.leads ?? [];
    let verifiedEmailCount = 0;
    let emailableCount = 0;
    for (const lead of leads) {
      const verified = lead.verifiedEmails?.length ?? 0;
      const listed = lead.emails?.length ?? 0;
      if (verified > 0) verifiedEmailCount++;
      if (verified > 0 || listed > 0 || lead.email?.trim()) emailableCount++;
    }
    return {
      totalFound: data.totalFound ?? data.total ?? leads.length,
      verifiedEmailCount,
      emailableCount,
    };
  } catch {
    return { totalFound: 0, verifiedEmailCount: 0, emailableCount: 0 };
  }
}

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function LockedContactValue({ value }: { value: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={LOCKED_FIELD_STYLE}>{value}</span>
      <span style={{ fontSize: 10, color: "#A78BFA", fontWeight: 600, display: "inline-flex", gap: 4 }}>
        <LockIcon size={12} />
        Locked
      </span>
    </span>
  );
}

function StarRating() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        marginBottom: 20,
      }}
    >
      <div style={{ color: "#FBBF24", fontSize: 18, letterSpacing: 2 }} aria-label="Five star rating">
        ★★★★★
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "#7878A0" }}>
        Trusted by freelancers and agencies finding clients every day
      </p>
    </div>
  );
}

export default function FreeTrialPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<TrialStatus>("idle");
  const [leads, setLeads] = useState<TrialLead[]>([]);
  const [trialCount, setTrialCount] = useState(0);
  const [message, setMessage] = useState("");
  const [showUpgradePanel, setShowUpgradePanel] = useState(false);
  const [showEmailHint, setShowEmailHint] = useState(false);
  const [gatePassed, setGatePassed] = useState(false);
  const [gateEmail, setGateEmail] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState("");
  const [aggregateStats, setAggregateStats] = useState<TrialAggregateStats>({
    totalFound: 0,
    verifiedEmailCount: 0,
    emailableCount: 0,
  });

  const searchesRemaining = Math.max(0, 2 - trialCount);
  const currentEmailableCount = useMemo(() => countEmailableInLeads(leads), [leads]);

  const openUpgrade = useCallback(() => setShowUpgradePanel(true), []);

  useEffect(() => {
    const savedEmail = getTrialEmail();
    if (savedEmail) {
      setGateEmail(savedEmail);
      setGatePassed(true);
    }
  }, []);

  useEffect(() => {
    const count = getTrialCount();
    setTrialCount(count);
    if (count >= 2) setStatus("limit");
  }, []);

  useEffect(() => {
    if (status !== "searching") return;

    const progressMessages = [
      `Scanning for ${query} in ${location}...`,
      "Extracting business details...",
      "Collecting phone numbers and addresses...",
      "Almost done. Finalizing results...",
    ];

    let msgIndex = 0;
    const interval = setInterval(() => {
      msgIndex = Math.min(msgIndex + 1, progressMessages.length - 1);
      setMessage(progressMessages[msgIndex]);
    }, 3000);

    return () => clearInterval(interval);
  }, [status, query, location]);

  async function handleGateSubmit() {
    const email = gateEmail.toLowerCase().trim();
    if (!EMAIL_RE.test(email)) {
      setGateError("Enter a valid email address.");
      return;
    }

    const apiUrl = getApiUrl();
    if (!apiUrl) {
      setGateError("Service is not configured. Please try again later.");
      return;
    }

    setGateLoading(true);
    setGateError("");
    try {
      const res = await fetch(`${apiUrl}/trial/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Signup failed");
      }
      setTrialEmail(email);
      setGatePassed(true);
    } catch (err) {
      setGateError(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setGateLoading(false);
    }
  }

  const connectToStream = useCallback(
    (searchId: string, searchNumber: number) => {
      const apiUrl = getApiUrl();
      if (!apiUrl) {
        setMessage("Search service is not configured.");
        setStatus("idle");
        return;
      }

      const es = new EventSource(`${apiUrl}/search/${searchId}/stream`);
      const pendingLeads: TrialLead[] = [];
      const seenKeys = new Set<string>();
      let leadCount = 0;

      const flushPending = () => {
        if (pendingLeads.length === 0) return;
        const batch = [...pendingLeads];
        pendingLeads.length = 0;
        setLeads((prev) => [...prev, ...batch].slice(0, MAX_TRIAL_LEADS));
      };

      const flush = setInterval(flushPending, 300);

      const finishSearch = async () => {
        clearInterval(flush);
        es.close();
        flushPending();
        setStatus(searchNumber >= 2 ? "limit" : "complete");
        setMessage("");

        const stats = await fetchSearchStats(searchId);
        setAggregateStats((prev) => ({
          totalFound: prev.totalFound + stats.totalFound,
          verifiedEmailCount: prev.verifiedEmailCount + stats.verifiedEmailCount,
          emailableCount: prev.emailableCount + stats.emailableCount,
        }));

        if (searchNumber === 1) {
          setShowEmailHint(true);
        }
        if (searchNumber >= 2) {
          setShowUpgradePanel(true);
        }
      };

      const handleZeroResults = () => {
        clearInterval(flush);
        es.close();
        flushPending();
        setStatus("idle");
        setMessage(
          "No results found. Try a broader search like restaurants in Lagos Nigeria or dentists in London UK."
        );
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            type: string;
            data?: BusinessLead;
            lead?: BusinessLead;
            total?: number;
            processed?: number;
            message?: string;
          };

          if (data.type === "lead") {
            const raw = data.data ?? data.lead;
            if (!raw) return;

            const normalized = normalizeLead(raw);
            const key = `${normalized.business_name.toLowerCase()}-${(normalized.phone ?? "").replace(/\s/g, "")}`;
            if (seenKeys.has(key)) return;
            seenKeys.add(key);

            if (leadCount >= MAX_TRIAL_LEADS) {
              void finishSearch();
              return;
            }

            pendingLeads.push(normalized);
            leadCount++;

            if (leadCount >= MAX_TRIAL_LEADS) {
              setTimeout(() => void finishSearch(), 600);
            }
          }

          if (data.type === "complete") {
            if ((data.total ?? 0) === 0 && leadCount === 0) {
              handleZeroResults();
              return;
            }
            void finishSearch();
          }

          if (data.type === "error") {
            clearInterval(flush);
            es.close();
            setMessage(data.message || "Search did not complete. Please try again.");
            setStatus("idle");
          }
        } catch {
          /* ignore parse errors */
        }
      };

      es.onerror = () => {
        clearInterval(flush);
        es.close();
        flushPending();
        if (leadCount === 0) {
          setStatus("idle");
          setMessage("Connection lost. Please try again.");
        } else {
          void finishSearch();
        }
      };
    },
    []
  );

  async function runTrialSearch() {
    if (!query.trim() || !location.trim()) return;
    if (trialCount >= 2) {
      setStatus("limit");
      setShowUpgradePanel(true);
      return;
    }

    const apiUrl = getApiUrl();
    if (!apiUrl) {
      setMessage("Search service is not configured.");
      return;
    }

    const nextSearchNumber = trialCount + 1;
    setStatus("searching");
    setLeads([]);
    setMessage(`Scanning for ${query.trim()} in ${location.trim()}...`);

    try {
      const res = await fetch(`${apiUrl}/freetrial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          location: location.trim(),
          visitorId: getVisitorId(),
        }),
      });

      if (res.status === 429) {
        incrementTrialCount();
        setTrialCount(2);
        setStatus("limit");
        setShowUpgradePanel(true);
        void recordSearchUsed(getTrialEmail());
        return;
      }

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Search failed");
      }

      const data = (await res.json()) as { searchId: string };
      incrementTrialCount();
      setTrialCount((prev) => prev + 1);
      void recordSearchUsed(getTrialEmail());
      connectToStream(data.searchId, nextSearchNumber);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Search failed. Please try again.");
      setStatus("idle");
    }
  }

  const tapTarget: CSSProperties = {
    minHeight: 48,
    minWidth: 48,
    padding: "12px 16px",
  };

  return (
    <div
      className="min-h-screen text-[#F0EFFF]"
      style={{
        background: "#06060A",
        fontFamily: FONT_STACK,
        paddingBottom: showUpgradePanel ? 320 : 40,
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <header
        className="flex items-center justify-between px-4 md:px-8 py-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <a
          href={SITE_URL}
          className="text-lg font-bold tracking-tight"
          style={{ color: "#F0EFFF", ...tapTarget, display: "inline-flex", alignItems: "center" }}
        >
          LeadThur
        </a>
        <a
          href={PAYSTACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#A78BFA",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "underline",
            ...tapTarget,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Get Full Access
        </a>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {!gatePassed ? (
          <section
            className="mx-auto max-w-md rounded-2xl p-6 md:p-8 text-center"
            style={{
              background: "#111118",
              border: "1px solid rgba(124,58,237,0.25)",
            }}
          >
            <StarRating />
            <p
              className="text-base md:text-lg mb-6 leading-relaxed"
              style={{ color: "#C0C0D8", marginTop: 0 }}
            >
              Type your service and any city. Get real businesses with real phone numbers and real
              email addresses in about 60 seconds. Twice, free.
            </p>
            <input
              type="email"
              placeholder="your@email.com"
              value={gateEmail}
              onChange={(e) => setGateEmail(e.target.value)}
              disabled={gateLoading}
              className="w-full rounded-lg text-base outline-none mb-2"
              style={{
                ...tapTarget,
                background: "#0D0D16",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#F0EFFF",
              }}
              onKeyDown={(e) => e.key === "Enter" && void handleGateSubmit()}
            />
            {gateError && <p className="text-sm text-red-400 mb-2">{gateError}</p>}
            <button
              type="button"
              onClick={() => void handleGateSubmit()}
              disabled={gateLoading || !gateEmail.trim()}
              className="w-full font-extrabold rounded-xl mb-2"
              style={{
                ...tapTarget,
                background: gateLoading ? "#4C1D95" : "#7C3AED",
                color: "white",
                cursor: gateLoading ? "not-allowed" : "pointer",
                fontSize: 17,
                border: "none",
                boxShadow: gateLoading ? "none" : "0 0 48px rgba(124,58,237,0.45)",
              }}
            >
              {gateLoading ? "Starting..." : "Start My 2 Free Searches"}
            </button>
            <p className="text-xs text-[#555575] mt-2" style={{ marginBottom: 0 }}>
              No card. No spam. Two searches, then you decide.
            </p>
          </section>
        ) : (
          <>
            {searchesRemaining > 0 && status !== "limit" && (
              <div
                className="mb-6 text-center text-sm font-semibold rounded-lg py-3 px-4"
                style={{
                  background: "rgba(124,58,237,0.12)",
                  border: "1px solid rgba(124,58,237,0.25)",
                  color: "#E9D5FF",
                }}
              >
                {searchesRemaining === 2
                  ? "2 free searches left"
                  : "1 free search left"}
              </div>
            )}

            {status === "limit" && trialCount >= 2 && !showUpgradePanel && (
              <div className="mb-6 text-center">
                <button
                  type="button"
                  onClick={openUpgrade}
                  style={{
                    ...tapTarget,
                    width: "100%",
                    maxWidth: 420,
                    margin: "0 auto",
                    display: "block",
                    background: "#7C3AED",
                    color: "#fff",
                    fontWeight: 800,
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                >
                  Get lifetime access
                </button>
              </div>
            )}

            {status !== "limit" && (
              <>
                <div className="flex flex-col gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="e.g. restaurants, dentists, gyms"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={status === "searching"}
                    className="w-full rounded-lg text-sm outline-none"
                    style={{
                      ...tapTarget,
                      background: "#111118",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#F0EFFF",
                    }}
                    onKeyDown={(e) => e.key === "Enter" && void runTrialSearch()}
                  />
                  <input
                    type="text"
                    placeholder="e.g. Lagos Nigeria, London UK"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={status === "searching"}
                    className="w-full rounded-lg text-sm outline-none"
                    style={{
                      ...tapTarget,
                      background: "#111118",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#F0EFFF",
                    }}
                    onKeyDown={(e) => e.key === "Enter" && void runTrialSearch()}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void runTrialSearch()}
                  disabled={status === "searching" || !query.trim() || !location.trim()}
                  className="w-full font-extrabold rounded-xl"
                  style={{
                    ...tapTarget,
                    background: status === "searching" ? "#4C1D95" : "#7C3AED",
                    color: "white",
                    fontSize: 16,
                    border: "none",
                    cursor: status === "searching" ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow:
                      status === "searching" ? "none" : "0 0 40px rgba(124,58,237,0.4)",
                  }}
                >
                  {status === "searching" ? (
                    <>
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          border: "2px solid rgba(255,255,255,0.3)",
                          borderTop: "2px solid white",
                          borderRadius: "50%",
                          display: "inline-block",
                          animation: "spin 0.8s linear infinite",
                        }}
                      />
                      Searching...
                    </>
                  ) : (
                    "Run free search"
                  )}
                </button>

                {status === "idle" && leads.length === 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p
                      style={{
                        fontSize: 11,
                        color: "#555575",
                        marginBottom: 10,
                        textAlign: "center",
                      }}
                    >
                      Try one of these
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        justifyContent: "center",
                      }}
                    >
                      {[
                        { q: "restaurants", l: "Lagos Nigeria" },
                        { q: "dentists", l: "Abuja Nigeria" },
                        { q: "salons", l: "London UK" },
                      ].map((ex) => (
                        <button
                          key={`${ex.q}-${ex.l}`}
                          type="button"
                          onClick={() => {
                            setQuery(ex.q);
                            setLocation(ex.l);
                          }}
                          style={{
                            ...tapTarget,
                            background: "transparent",
                            border: "1px solid rgba(124,58,237,0.25)",
                            color: "#A78BFA",
                            borderRadius: 100,
                            fontSize: 12,
                            cursor: "pointer",
                            fontWeight: 500,
                            fontFamily: "inherit",
                          }}
                        >
                          {ex.q} in {ex.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {message && status !== "idle" && (
                  <p className="text-sm text-[#7878A0] mt-4">{message}</p>
                )}
              </>
            )}

            {leads.length > 0 && (
              <section className="mt-8">
                <div
                  className="flex flex-col gap-2 mb-4 md:flex-row md:flex-wrap"
                  style={{ alignItems: "stretch" }}
                >
                  <button
                    type="button"
                    onClick={openUpgrade}
                    style={{
                      ...tapTarget,
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      background: "rgba(124,58,237,0.15)",
                      border: "1px solid rgba(124,58,237,0.35)",
                      color: "#C4B5FD",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <LockIcon />
                    Send email to {currentEmailableCount} businesses, locked
                  </button>
                  <button
                    type="button"
                    onClick={openUpgrade}
                    style={{
                      ...tapTarget,
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#9CA3AF",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <LockIcon />
                    Export CSV, locked
                  </button>
                </div>

                {showEmailHint && trialCount === 1 && status === "complete" && (
                  <p
                    className="text-sm mb-4"
                    style={{ color: "#7878A0", lineHeight: 1.6, marginTop: 0 }}
                  >
                    Emailing all of these takes one click with lifetime access.
                  </p>
                )}

                <div className="flex flex-col gap-2 md:hidden">
                  {leads.map((lead) => (
                    <div
                      key={lead.id}
                      style={{
                        background: "#111118",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 12,
                        padding: 16,
                        animation: "fadeIn 0.3s ease",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#F0EFFF", marginBottom: 8 }}>
                        {lead.business_name}
                      </div>
                      {lead.address && (
                        <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                          <span style={{ color: "#555575", fontSize: 12, flexShrink: 0 }}>Address</span>
                          <span style={{ color: "#C0C0D8", fontSize: 12, lineHeight: 1.4 }}>{lead.address}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ color: "#555575", fontSize: 12, flexShrink: 0 }}>Phone</span>
                        {lead.phone ? (
                          <a
                            href={`tel:${lead.phone}`}
                            style={{ color: "#F0EFFF", fontSize: 13, fontWeight: 600, textDecoration: "none", minHeight: 48, display: "inline-flex", alignItems: "center" }}
                          >
                            {lead.phone}
                          </a>
                        ) : (
                          <span style={{ color: "#555575", fontSize: 12 }}>Not listed</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ color: "#555575", fontSize: 12, flexShrink: 0 }}>Email</span>
                        <LockedContactValue value={generatePlaceholderEmail(lead.business_name)} />
                      </div>
                      {lead.rating != null && (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ color: "#FBBF24", fontSize: 13 }}>★</span>
                          <span style={{ color: "#FBBF24", fontSize: 12, fontWeight: 700 }}>{lead.rating}</span>
                          {lead.reviews_count != null && (
                            <span style={{ color: "#555575", fontSize: 11 }}>
                              ({lead.reviews_count.toLocaleString()} reviews)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div
                  className="hidden md:block"
                  style={{
                    background: "#0D0D16",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.8fr 2fr 1.4fr 2fr 1fr",
                      padding: "12px 16px",
                      background: "#111118",
                      borderBottom: "1px solid rgba(255,255,255,0.07)",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#555575",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span>Business</span>
                    <span>Address</span>
                    <span>Phone</span>
                    <span>Email</span>
                    <span>Rating</span>
                  </div>
                  {leads.map((lead, i) => (
                    <div
                      key={lead.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.8fr 2fr 1.4fr 2fr 1fr",
                        padding: "14px 16px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        fontSize: 13,
                        alignItems: "center",
                        animation: "fadeIn 0.3s ease",
                        animationDelay: `${i * 40}ms`,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#F0EFFF" }}>{lead.business_name}</span>
                      <span style={{ color: "#7878A0" }} title={lead.address || undefined}>
                        {lead.address ? truncateAddress(lead.address, 35) : "n/a"}
                      </span>
                      <span>
                        {lead.phone ? (
                          <a href={`tel:${lead.phone}`} style={{ color: "#F0EFFF", textDecoration: "none" }}>
                            {lead.phone}
                          </a>
                        ) : (
                          <span style={{ color: "#555575" }}>Not listed</span>
                        )}
                      </span>
                      <span>
                        <LockedContactValue value={generatePlaceholderEmail(lead.business_name)} />
                      </span>
                      <span style={{ color: "#FBBF24", fontWeight: 700 }}>
                        {lead.rating != null ? `★ ${lead.rating}` : "n/a"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer
        className="text-center text-xs py-8 px-4 border-t"
        style={{ borderColor: "rgba(255,255,255,0.06)", color: "#555575" }}
      >
        <a href={SITE_URL} className="hover:text-[#7878A0]" style={{ minHeight: 48, display: "inline-flex", alignItems: "center" }}>
          LeadThur · Business Discovery Intelligence
        </a>
      </footer>

      {showUpgradePanel && gatePassed && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50"
          style={{
            background: "linear-gradient(to top, rgba(6,6,10,0.97) 70%, transparent)",
            padding: "24px 16px 20px",
            pointerEvents: "none",
          }}
        >
          <div
            className="mx-auto max-w-md rounded-2xl p-6"
            style={{
              background: "rgba(17,17,24,0.96)",
              border: "1px solid rgba(124,58,237,0.45)",
              boxShadow: "0 0 80px rgba(124,58,237,0.25)",
              pointerEvents: "auto",
              maxHeight: "min(72vh, 520px)",
              overflowY: "auto",
            }}
          >
            <p style={{ fontSize: 17, fontWeight: 800, color: "#F0EFFF", lineHeight: 1.5, margin: "0 0 16px" }}>
              You found {aggregateStats.totalFound.toLocaleString()} potential clients.{" "}
              {aggregateStats.verifiedEmailCount.toLocaleString()} of them have a verified email
              address sitting in front of you. Emailing all of them takes one click, and that click
              is behind lifetime access.
            </p>

            <ul
              style={{
                listStyle: "none",
                margin: "0 0 16px",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {[
                `₦${SALE_PRICE_NGN.toLocaleString()} once for lifetime access`,
                "Search any service in any city and build your pipeline",
                "Export your potential client lists to CSV",
                "One click outreach to businesses with verified emails",
              ].map((item) => (
                <li key={item} style={{ fontSize: 14, color: "#C0C0D8", lineHeight: 1.45, paddingLeft: 18, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "#34D399" }}>+</span>
                  {item}
                </li>
              ))}
            </ul>

            <p style={{ fontSize: 13, color: "#7878A0", margin: "0 0 8px", lineHeight: 1.5 }}>
              Six of twenty lifetime slots remain before the price becomes ₦100,000 per year.
            </p>
            <p style={{ fontSize: 13, color: "#7878A0", margin: "0 0 16px", lineHeight: 1.5 }}>
              30 day money back guarantee. If LeadThur does not help you find potential clients, email
              support and we refund you.
            </p>

            <a
              href={PAYSTACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block font-extrabold rounded-xl text-center"
              style={{
                ...tapTarget,
                background: "#7C3AED",
                color: "white",
                textDecoration: "none",
                boxShadow: "0 0 40px rgba(124,58,237,0.45)",
                fontSize: 16,
              }}
            >
              Get lifetime access for ₦{SALE_PRICE_NGN.toLocaleString()}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
