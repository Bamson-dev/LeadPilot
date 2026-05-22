"use client";

import { useCallback, useEffect, useState } from "react";
import type { BusinessLead } from "@leadpilot/shared";
import { getApiUrl } from "@/utils/env";
import { Lock } from "lucide-react";

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

function maskWebsite(url: string | null): string {
  if (!url) return "—";
  const display = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const visible = display.substring(0, 12);
  return `${visible}███████`;
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const count = getTrialCount();
    setTrialCount(count);
    if (count >= 2) setStatus("limit");
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const finishTrial = useCallback((foundTotal: number) => {
    setTotalFound((prev) => Math.max(prev, foundTotal, MAX_TRIAL_LEADS));
    setStatus("complete");
    setShowPaywall(true);
  }, []);

  const connectToStream = useCallback(
    (searchId: string) => {
      const apiUrl = getApiUrl();
      if (!apiUrl) {
        setMessage("Search service is not configured.");
        setStatus("idle");
        return;
      }

      const es = new EventSource(`${apiUrl}/search/${searchId}/stream`);
      const pendingLeads: TrialLead[] = [];
      let leadCount = 0;
      let streamTotal = 0;

      const flush = setInterval(() => {
        if (pendingLeads.length === 0) return;
        const batch = [...pendingLeads];
        pendingLeads.length = 0;
        setLeads((prev) => {
          const combined = [...prev, ...batch];
          return combined.slice(0, MAX_TRIAL_LEADS);
        });
      }, 300);

      const stopStream = (found?: number) => {
        clearInterval(flush);
        es.close();
        if (pendingLeads.length > 0) {
          setLeads((prev) =>
            [...prev, ...pendingLeads].slice(0, MAX_TRIAL_LEADS)
          );
        }
        finishTrial(found ?? Math.max(streamTotal, leadCount, 200));
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

            if (leadCount >= MAX_TRIAL_LEADS) {
              stopStream(streamTotal);
              return;
            }

            pendingLeads.push(normalizeLead(raw));
            leadCount++;
            setMessage(`Found ${leadCount} businesses so far...`);

            if (leadCount >= MAX_TRIAL_LEADS) {
              setTimeout(() => stopStream(streamTotal), 600);
            }
          }

          if (data.type === "progress") {
            const count = data.processed ?? leadCount;
            streamTotal = Math.max(streamTotal, data.total ?? count, count);
            setTotalFound(streamTotal);
            setMessage(`Found ${leadCount} businesses so far...`);
          }

          if (data.type === "complete") {
            streamTotal = Math.max(streamTotal, data.total ?? leadCount);
            stopStream(streamTotal);
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
        stopStream(Math.max(streamTotal, leadCount, 200));
      };
    },
    [finishTrial]
  );

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
    setMessage(`Searching for ${query} in ${location}...`);

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

  const paywallTotal =
    totalFound > 200 ? "200+" : totalFound > 15 ? `${totalFound}+` : "200+";

  return (
    <div
      className="min-h-screen text-[#F0EFFF]"
      style={{ background: "#06060A", paddingBottom: showPaywall ? 280 : 40 }}
    >
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
              className="w-full sm:w-auto font-bold px-8 py-3 rounded-lg disabled:opacity-50"
              style={{ background: "#7C3AED", color: "white" }}
            >
              {status === "searching" ? "Searching..." : "Search"}
            </button>

            {trialCount === 1 && (
              <p className="text-xs text-[#555575] mt-2">1 of 2 free searches used.</p>
            )}

            {message && status !== "idle" && (
              <p className="text-sm text-[#7878A0] mt-4">{message}</p>
            )}
          </>
        )}

        {leads.length > 0 && (
          <section className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm border-collapse">
              <thead>
                <tr
                  className="text-left text-xs uppercase tracking-wider"
                  style={{ color: "#7878A0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <th className="py-3 pr-4">Business Name</th>
                  <th className="py-3 pr-4">Address</th>
                  <th className="py-3 pr-4">Phone</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Website</th>
                  <th className="py-3">Rating</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr
                    key={lead.id}
                    className="trial-row-fade"
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      animationDelay: `${i * 40}ms`,
                    }}
                  >
                    <td className="py-3 pr-4 font-semibold">{lead.business_name}</td>
                    <td className="py-3 pr-4 text-[#7878A0] max-w-[160px] truncate">
                      {lead.address || "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="text-[#F0EFFF] hover:underline">
                          {lead.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[#7878A0] select-none"
                          style={{ filter: "blur(4px)" }}
                        >
                          ████████@██████.com
                        </span>
                        <Lock className="h-3.5 w-3.5 shrink-0 text-[#7C3AED]" />
                        <span className="text-[10px] text-[#7C3AED] whitespace-nowrap">
                          Unlock with full access
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {lead.website ? (
                        <span
                          className="text-[#7878A0] select-none"
                          style={{ filter: "blur(3px)" }}
                        >
                          {maskWebsite(lead.website)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 text-amber-400">
                      {lead.rating != null ? `★ ${lead.rating}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <p className="text-xs text-[#7878A0] mb-1">You are seeing 15 of</p>
            <p
              className="text-3xl font-black mb-1"
              style={{ color: "#F0EFFF", letterSpacing: -1 }}
            >
              {paywallTotal} businesses
            </p>
            <p className="text-xs text-[#7878A0] mb-5 leading-relaxed">
              found for <strong className="text-[#F0EFFF]">{query} in {location}</strong>.
              <br />
              Get full access to see all of them with complete contact details.
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
            <a href={SITE_URL} className="text-xs text-[#555575] hover:underline">
              Learn more about LeadPilot
            </a>
          </div>
        </div>
      )}

    </div>
  );
}
