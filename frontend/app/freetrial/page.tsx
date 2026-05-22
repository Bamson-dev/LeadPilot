"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { BusinessLead } from "@leadpilot/shared";
import { getApiUrl } from "@/utils/env";
import { useIsMobile } from "@/hooks/useIsMobile";

const MAX_TRIAL_LEADS = 15;
const PAYSTACK_URL = "https://paystack.shop/pay/Leadpilot";
const SITE_URL = "https://www.leadpilot.live";

type TrialStatus = "idle" | "searching" | "complete" | "limit";

interface TrialLead {
  id: string;
  business_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
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
  const emails =
    raw.emails?.length > 0
      ? raw.emails
      : raw.verifiedEmails?.length > 0
        ? raw.verifiedEmails
        : raw.email
          ? raw.email.split(/,\s*/)
          : [];
  return {
    id: raw.id,
    business_name: raw.name,
    address: raw.address || null,
    phone: raw.phone,
    email: emails[0] ?? raw.email,
    website: raw.website,
    rating: raw.rating,
    reviews_count: raw.reviewCount,
  };
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

function generatePlaceholderPhone(location: string): string {
  const loc = location.toLowerCase();
  if (loc.includes("nigeria") || loc.includes("lagos") || loc.includes("abuja")) {
    return "+234 803 456 7890";
  }
  if (loc.includes("uk") || loc.includes("london")) {
    return "+44 20 7946 0958";
  }
  if (loc.includes("kenya") || loc.includes("nairobi")) {
    return "+254 712 345 678";
  }
  if (loc.includes("uae") || loc.includes("dubai")) {
    return "+971 4 123 4567";
  }
  return "+1 555 123 4567";
}

const LOCKED_FIELD_STYLE: CSSProperties = {
  filter: "blur(5px)",
  userSelect: "none",
  fontSize: 12,
  color: "#C0C0D8",
  background: "rgba(124,58,237,0.08)",
  padding: "2px 8px",
  borderRadius: 4,
};

const MARKETING_TOTAL = "200+";

function LockedContactValue({
  value,
  unlockLabel = "🔒 Unlock",
}: {
  value: string;
  unlockLabel?: string;
}) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={LOCKED_FIELD_STYLE}>{value}</span>
      <span style={{ fontSize: 10, color: "#A78BFA", fontWeight: 600 }}>{unlockLabel}</span>
    </span>
  );
}

function truncateAddress(address: string, maxLen: number): string {
  if (address.length <= maxLen) return address;
  return `${address.slice(0, maxLen)}…`;
}

export default function FreeTrialPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<TrialStatus>("idle");
  const [leads, setLeads] = useState<TrialLead[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [trialCount, setTrialCount] = useState(0);
  const [message, setMessage] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const isMobile = useIsMobile();

  const progressMessages = [
    `Scanning for ${query} in ${location}...`,
    `Found first businesses. Extracting details...`,
    `Collecting phone numbers and addresses...`,
    `Almost done. Finalizing results...`,
  ];

  useEffect(() => {
    const count = getTrialCount();
    setTrialCount(count);
    if (count >= 2) setStatus("limit");
  }, []);

  useEffect(() => {
    if (status !== "searching") return;

    let msgIndex = 0;
    const interval = setInterval(() => {
      if (leads.length > 0) {
        setMessage(`Found ${leads.length} businesses so far...`);
      } else {
        msgIndex = Math.min(msgIndex + 1, progressMessages.length - 1);
        setMessage(progressMessages[msgIndex]);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, leads.length, query, location]);

  const connectToStream = useCallback((searchId: string) => {
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
    let streamTotal = 0;

    const flushPending = () => {
      if (pendingLeads.length === 0) return;
      const batch = [...pendingLeads];
      pendingLeads.length = 0;
      setLeads((prev) => [...prev, ...batch].slice(0, MAX_TRIAL_LEADS));
    };

    const flush = setInterval(flushPending, 300);

    const finishSearch = (total: number, showPaywallAfter: boolean) => {
      clearInterval(flush);
      es.close();
      flushPending();
      setTotalFound(total);
      setStatus("complete");
      if (showPaywallAfter) {
        setShowPaywall(true);
      }
    };

    const handleZeroResults = () => {
      clearInterval(flush);
      es.close();
      flushPending();
      setStatus("idle");
      setShowPaywall(false);
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
          phase?: string;
        };

        if (data.type === "phase" && data.phase) {
          setMessage(data.phase);
        }

        if (data.type === "lead") {
          const raw = data.data ?? data.lead;
          if (!raw) return;

          const normalized = normalizeLead(raw);
          const key = `${normalized.business_name.toLowerCase()}-${(normalized.phone ?? "").replace(/\s/g, "")}`;
          if (seenKeys.has(key)) return;
          seenKeys.add(key);

          if (leadCount >= MAX_TRIAL_LEADS) {
            finishSearch(streamTotal, leadCount >= 5);
            return;
          }

          pendingLeads.push(normalized);
          leadCount++;
          setMessage(`Found ${leadCount} businesses so far...`);

          if (leadCount >= MAX_TRIAL_LEADS) {
            setTimeout(() => {
              finishSearch(streamTotal, leadCount >= 5);
            }, 600);
          }
        }

        if (data.type === "progress") {
          const count = data.processed ?? leadCount;
          streamTotal = Math.max(streamTotal, data.total ?? count, count);
          setTotalFound(streamTotal);
          if (data.message) setMessage(data.message);
          else if (leadCount > 0) {
            setMessage(`Found ${leadCount} businesses so far...`);
          }
        }

        if (data.type === "complete") {
          streamTotal = Math.max(streamTotal, data.total ?? leadCount);
          if ((data.total ?? 0) === 0 && leadCount === 0) {
            handleZeroResults();
            return;
          }
          finishSearch(streamTotal, leadCount >= 5);
        }

        if (data.type === "error") {
          clearInterval(flush);
          es.close();
          setMessage(data.message || "Search did not complete. Please try again.");
          setStatus("idle");
          setShowPaywall(false);
        }
      } catch {
        /* ignore parse errors */
      }
    };

    es.onerror = () => {
      clearInterval(flush);
      es.close();
      flushPending();
      if (leadCount >= 5) {
        finishSearch(Math.max(streamTotal, leadCount), true);
      } else if (leadCount === 0) {
        setStatus("idle");
        setMessage("Connection lost. Please try again.");
        setShowPaywall(false);
      } else {
        setStatus("complete");
        setShowPaywall(false);
      }
    };
  }, []);

  async function runTrialSearch() {
    if (!query.trim() || !location.trim()) return;
    if (trialCount >= 2) {
      setStatus("limit");
      return;
    }

    const apiUrl = getApiUrl();
    if (!apiUrl) {
      setMessage("Search service is not configured.");
      return;
    }

    setStatus("searching");
    setLeads([]);
    setShowPaywall(false);
    setTotalFound(0);
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
        return;
      }

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Search failed");
      }

      const data = (await res.json()) as { searchId: string };
      incrementTrialCount();
      setTrialCount((prev) => prev + 1);
      connectToStream(data.searchId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Search failed. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <div
      className="min-h-screen text-[#F0EFFF]"
      style={{ background: "#06060A", paddingBottom: showPaywall ? 280 : 40 }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <header
        className="flex items-center justify-between px-4 sm:px-8 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <a
          href={SITE_URL}
          className="text-lg font-bold tracking-tight"
          style={{ color: "#F0EFFF", fontFamily: "Bricolage Grotesque, Inter, sans-serif" }}
        >
          LeadPilot
        </a>
        <a
          href={PAYSTACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-bold px-4 py-2 rounded-lg"
          style={{ background: "#7C3AED", color: "white" }}
        >
          Get Full Access
        </a>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <section className="text-center mb-10">
          <h1
            className="text-3xl sm:text-4xl font-black mb-3"
            style={{ fontFamily: "Bricolage Grotesque, Inter, sans-serif", letterSpacing: -1 }}
          >
            See it work before you pay.
          </h1>
          <p className="text-[#7878A0] text-sm sm:text-base max-w-md mx-auto">
            Run a real search. Get real results. No signup needed.
          </p>
          <p className="text-[#555575] text-xs mt-3">Free preview — 2 searches allowed</p>
        </section>

        {status === "limit" ? (
          <div
            className="mx-auto max-w-md text-center rounded-2xl p-8"
            style={{
              background: "#111118",
              border: "1px solid rgba(124,58,237,0.3)",
            }}
          >
            <div className="text-4xl mb-4">🔒</div>
            <p className="text-xl font-extrabold mb-2">You have used your 2 free searches</p>
            <p className="text-sm text-[#7878A0] mb-6 leading-relaxed">
              You have seen how LeadPilot works. Get full access to run unlimited searches and
              export all results.
            </p>
            <a
              href={PAYSTACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block font-extrabold py-4 rounded-lg mb-3"
              style={{
                background: "#7C3AED",
                color: "white",
                boxShadow: "0 0 40px rgba(124,58,237,0.4)",
              }}
            >
              Get Full Access — ₦15,000 Lifetime
            </a>
            <a href={SITE_URL} className="text-xs text-[#555575] hover:underline">
              Back to LeadPilot.live
            </a>
          </div>
        ) : (
          <>
            <div
              className="gap-3 mb-3"
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <input
                type="text"
                placeholder="e.g. restaurants, dentists, gyms"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={status === "searching"}
                className="flex-1 w-full rounded-lg px-4 py-3 text-sm outline-none"
                style={{
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
                className="flex-1 w-full rounded-lg px-4 py-3 text-sm outline-none"
                style={{
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
              style={{
                background: status === "searching" ? "#4C1D95" : "#7C3AED",
                color: "white",
                fontWeight: 800,
                fontSize: 16,
                padding: "16px 32px",
                borderRadius: 12,
                border: "none",
                cursor: status === "searching" ? "not-allowed" : "pointer",
                width: isMobile ? "100%" : "auto",
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: "center",
                transition: "all 0.2s",
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
                <>🔍 Search — Free Preview</>
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
                    { q: "gyms", l: "Nairobi Kenya" },
                    { q: "hotels", l: "Dubai UAE" },
                  ].map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setQuery(ex.q);
                        setLocation(ex.l);
                      }}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(124,58,237,0.25)",
                        color: "#A78BFA",
                        padding: "7px 14px",
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

            {trialCount === 1 && (
              <p className="text-xs text-[#555575] mt-2">1 of 2 free searches used.</p>
            )}

            {message && status !== "idle" && (
              <p className="text-sm text-[#7878A0] mt-4">{message}</p>
            )}
          </>
        )}

        {leads.length > 0 && (
          <section className="mt-10">
            {isMobile ? (
              <div>
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    style={{
                      background: "#111118",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 8,
                      animation: "fadeIn 0.3s ease",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        color: "#F0EFFF",
                        marginBottom: 8,
                      }}
                    >
                      {lead.business_name}
                    </div>
                    {lead.address && (
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginBottom: 6,
                          alignItems: "flex-start",
                        }}
                      >
                        <span style={{ color: "#555575", fontSize: 12, flexShrink: 0 }}>
                          Address
                        </span>
                        <span style={{ color: "#C0C0D8", fontSize: 12, lineHeight: 1.4 }}>
                          {lead.address}
                        </span>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginBottom: 6,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ color: "#555575", fontSize: 12, flexShrink: 0 }}>
                        Phone
                      </span>
                      {lead.phone ? (
                        <a
                          href={`tel:${lead.phone}`}
                          style={{
                            color: "#F0EFFF",
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          {lead.phone}
                        </a>
                      ) : (
                        <LockedContactValue
                          value={generatePlaceholderPhone(location)}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ color: "#555575", fontSize: 12, flexShrink: 0 }}>
                        Email
                      </span>
                      <LockedContactValue
                        value={generatePlaceholderEmail(lead.business_name)}
                      />
                    </div>
                    {lead.rating != null && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ color: "#FBBF24", fontSize: 13 }}>★</span>
                        <span style={{ color: "#FBBF24", fontSize: 12, fontWeight: 700 }}>
                          {lead.rating}
                        </span>
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
            ) : (
              <div
                style={{
                  background: "#0D0D16",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16,
                  overflow: "hidden",
                  marginTop: 24,
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
                    <span style={{ fontWeight: 700, color: "#F0EFFF" }}>
                      {lead.business_name}
                    </span>
                    <span
                      style={{ color: "#7878A0" }}
                      title={lead.address || undefined}
                    >
                      {lead.address
                        ? truncateAddress(lead.address, 35)
                        : "—"}
                    </span>
                    <span>
                      {lead.phone ? (
                        <a
                          href={`tel:${lead.phone}`}
                          style={{ color: "#F0EFFF", textDecoration: "none" }}
                        >
                          {lead.phone}
                        </a>
                      ) : (
                        <LockedContactValue
                          value={generatePlaceholderPhone(location)}
                        />
                      )}
                    </span>
                    <span>
                      <LockedContactValue
                        value={generatePlaceholderEmail(lead.business_name)}
                      />
                    </span>
                    <span style={{ color: "#FBBF24", fontWeight: 700 }}>
                      {lead.rating != null ? `★ ${lead.rating}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer
        className="text-center text-xs py-8 px-4 border-t"
        style={{ borderColor: "rgba(255,255,255,0.06)", color: "#555575" }}
      >
        <a href={SITE_URL} className="hover:text-[#7878A0]">
          LeadPilot — Business Discovery Intelligence
        </a>
        <span className="mx-2">·</span>
        <a href="https://wa.me/2349067285890" className="hover:text-[#7878A0]">
          WhatsApp 09067285890
        </a>
      </footer>

      {showPaywall && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 text-center paywall-slide-up"
          style={{
            background: "linear-gradient(to top, #06060A 60%, transparent)",
            padding: "32px 20px 24px",
          }}
        >
          <div
            className="mx-auto max-w-md rounded-2xl p-6"
            style={{
              background: "#111118",
              border: "1px solid rgba(124,58,237,0.4)",
              boxShadow: "0 0 80px rgba(124,58,237,0.2)",
            }}
          >
            <p
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: "#F0EFFF",
                letterSpacing: -1.5,
                marginBottom: 8,
                lineHeight: 1,
              }}
            >
              {MARKETING_TOTAL} more businesses
            </p>
            <p
              style={{
                fontSize: 14,
                color: "#7878A0",
                marginBottom: 6,
                lineHeight: 1.6,
              }}
            >
              You are seeing{" "}
              <strong style={{ color: "#F0EFFF" }}>
                {MAX_TRIAL_LEADS} of {MARKETING_TOTAL}
              </strong>{" "}
              businesses
              found for{" "}
              <strong style={{ color: "#F0EFFF" }}>
                {query} in {location}
              </strong>
              .
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#7878A0",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              Full access unlocks all results with complete emails, websites, and one-click CSV
              export.
            </p>
            <a
              href={PAYSTACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block font-extrabold py-4 rounded-lg mb-2"
              style={{
                background: "#7C3AED",
                color: "white",
                boxShadow: "0 0 40px rgba(124,58,237,0.4)",
              }}
            >
              Get Full Access — ₦15,000 Lifetime
            </a>
            <p style={{ fontSize: 11, color: "#555575", marginTop: 10 }}>
              ⚡ Instant access · One payment · No monthly fee
            </p>
            <a href={SITE_URL} className="text-xs text-[#555575] hover:underline block mt-2">
              Learn more about LeadPilot
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
