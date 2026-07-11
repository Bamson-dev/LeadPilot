"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { BusinessLead } from "@leadthur/shared";
import { getApiUrl } from "@/utils/env";
import { SALE_PRICE_USD } from "@/constants/pricing";

const MAX_TRIAL_LEADS = 15;
const CHECKOUT_URL = "/checkout";
const SITE_URL = "https://www.leadthur.com";
const TRIAL_EMAIL_KEY = "lp_trial_email";
const TRIAL_STATS_KEY = "lp_trial_stats";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PAYWALL_HEADING = "Pay once. Find clients forever.";

const PAYWALL_TIER_ONE = [
  { label: "1,000+ potential clients per search forever", compareAt: "$60" },
  { label: "Direct phone numbers and verified emails", compareAt: "$45" },
  { label: "The email sender built into the dashboard", compareAt: "$50" },
  { label: "Unlimited CSV export of every search", compareAt: "$25" },
] as const;

const PAYWALL_TIER_TWO = [
  "AI outreach writer that drafts every pitch",
  "Done for you pitch templates by service",
  "Open tracking and automatic follow ups",
  "Search history and 195 countries",
  "Every feature we add later at no extra charge",
] as const;

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

function PaywallValueRow({
  label,
  compareAt,
  free,
}: {
  label: string;
  compareAt?: string;
  free?: boolean;
}) {
  return (
    <li
      style={{
        fontSize: 14,
        color: "#C0C0D8",
        lineHeight: 1.45,
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <span>{label}</span>
      {compareAt ? (
        <span
          style={{
            textDecoration: "line-through",
            color: "#7878A0",
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {compareAt}
        </span>
      ) : free ? (
        <span style={{ color: "#34D399", fontWeight: 700, flexShrink: 0 }}>FREE</span>
      ) : null}
    </li>
  );
}

function isSearchReadyForPaywall(progress: {
  status: string;
  leads: TrialLead[];
  totalFound: number;
  emailScrapingComplete: boolean;
}): boolean {
  if (progress.status !== "completed" || !progress.emailScrapingComplete) {
    return false;
  }
  const targetRows = Math.min(MAX_TRIAL_LEADS, progress.totalFound || progress.leads.length);
  return progress.leads.length >= targetRows && progress.leads.length > 0;
}

function getTrialEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TRIAL_EMAIL_KEY) || "";
}

function setTrialEmail(email: string): void {
  localStorage.setItem(TRIAL_EMAIL_KEY, email);
}

function clearTrialEmail(): void {
  localStorage.removeItem(TRIAL_EMAIL_KEY);
}

function clearTrialSession(): void {
  clearTrialEmail();
  sessionStorage.removeItem(TRIAL_STATS_KEY);
}

function loadTrialStats(): TrialAggregateStats | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(TRIAL_STATS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrialAggregateStats;
    if (
      typeof parsed.totalFound === "number" &&
      typeof parsed.verifiedEmailCount === "number"
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveTrialStats(stats: TrialAggregateStats): void {
  sessionStorage.setItem(TRIAL_STATS_KEY, JSON.stringify(stats));
}

interface TrialSearchStatus {
  searchesUsed: number;
  searchesRemaining: number;
  maxSearches: number;
}

async function fetchTrialStatus(
  email: string
): Promise<TrialSearchStatus | "not_found" | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl || !email) return null;
  try {
    const res = await fetch(
      `${apiUrl}/trial/status?email=${encodeURIComponent(email.toLowerCase().trim())}`
    );
    if (res.status === 404) return "not_found";
    if (!res.ok) return null;
    return (await res.json()) as TrialSearchStatus;
  } catch {
    return null;
  }
}

function trialEmailQuery(email: string): string {
  return `trialEmail=${encodeURIComponent(email.toLowerCase().trim())}`;
}

function normalizeLead(raw: BusinessLead): TrialLead {
  const verifiedEmails = raw.verifiedEmails?.length ? [...raw.verifiedEmails] : [];
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

function mergeLeadUpdate(prev: TrialLead, raw: BusinessLead): TrialLead {
  const next = normalizeLead(raw);
  return {
    ...prev,
    ...next,
    business_name: prev.business_name || next.business_name,
    address: prev.address || next.address,
  };
}

function countVerifiedInLeads(leads: TrialLead[]): number {
  return leads.filter((lead) => lead.verifiedEmails.length > 0).length;
}

function countEmailableInLeads(leads: TrialLead[]): number {
  return leads.filter(
    (lead) =>
      lead.verifiedEmails.length > 0 ||
      lead.emails.length > 0 ||
      Boolean(lead.email?.trim())
  ).length;
}

function sendButtonCount(leads: TrialLead[]): number {
  const verified = countVerifiedInLeads(leads);
  if (verified > 0) return verified;
  const emailable = countEmailableInLeads(leads);
  if (emailable > 0) return emailable;
  return leads.length;
}

function lockedDisplayValue(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function hasTrialPhone(phone: string | null | undefined): boolean {
  return Boolean(phone?.trim());
}

function TrialPhoneValue({ phone }: { phone: string | null }) {
  if (hasTrialPhone(phone)) {
    return (
      <span style={{ fontSize: 13, color: "#C0C0D8", fontWeight: 600 }}>{phone!.trim()}</span>
    );
  }

  return (
    <span style={LOCKED_FIELD_STYLE} aria-label="Phone not listed">
      Not listed
    </span>
  );
}

function truncateAddress(address: string, maxLen: number): string {
  if (address.length <= maxLen) return address;
  return `${address.slice(0, maxLen)}…`;
}

async function fetchSearchStats(
  searchId: string,
  trialEmail: string
): Promise<TrialAggregateStats> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return { totalFound: 0, verifiedEmailCount: 0 };

  try {
    const res = await fetch(
      `${apiUrl}/search/results/${searchId}?limit=1000&${trialEmailQuery(trialEmail)}`
    );
    if (!res.ok) return { totalFound: 0, verifiedEmailCount: 0 };
    const data = (await res.json()) as {
      totalFound?: number;
      total?: number;
      leads?: BusinessLead[];
    };
    const rows = data.leads ?? [];
    let verifiedEmailCount = 0;
    for (const lead of rows) {
      if ((lead.verifiedEmails?.length ?? 0) > 0) verifiedEmailCount++;
    }
    return {
      totalFound: data.totalFound ?? data.total ?? rows.length,
      verifiedEmailCount,
    };
  } catch {
    return { totalFound: 0, verifiedEmailCount: 0 };
  }
}

async function fetchTrialSearchProgress(
  searchId: string,
  trialEmail: string
): Promise<{
  status: string;
  leads: TrialLead[];
  totalFound: number;
  queuePosition: number;
  verifiedEmailCount: number;
  emailScrapingComplete: boolean;
} | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  try {
    const res = await fetch(
      `${apiUrl}/search/results/${searchId}?limit=${MAX_TRIAL_LEADS}&${trialEmailQuery(trialEmail)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      leads?: BusinessLead[];
      totalFound?: number;
      total?: number;
      queuePosition?: number;
      emailScrapingComplete?: boolean;
    };
    const rows = data.leads ?? [];
    let verifiedEmailCount = 0;
    for (const lead of rows) {
      if ((lead.verifiedEmails?.length ?? 0) > 0) verifiedEmailCount++;
    }
    return {
      status: data.status ?? "pending",
      leads: rows.map(normalizeLead).slice(0, MAX_TRIAL_LEADS),
      totalFound: data.totalFound ?? data.total ?? rows.length,
      queuePosition: data.queuePosition ?? 0,
      verifiedEmailCount,
      emailScrapingComplete: Boolean(data.emailScrapingComplete),
    };
  } catch {
    return null;
  }
}

async function fetchVisibleLeads(
  searchId: string,
  trialEmail: string
): Promise<TrialLead[]> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return [];

  try {
    const res = await fetch(
      `${apiUrl}/search/results/${searchId}?limit=${MAX_TRIAL_LEADS}&${trialEmailQuery(trialEmail)}`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { leads?: BusinessLead[] };
    return (data.leads ?? []).map(normalizeLead).slice(0, MAX_TRIAL_LEADS);
  } catch {
    return [];
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
      <span
        style={{
          fontSize: 10,
          color: "#A78BFA",
          fontWeight: 600,
          display: "inline-flex",
          gap: 4,
          flexShrink: 0,
        }}
      >
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

function LeadRowMobile({ lead }: { lead: TrialLead }) {
  const emailDisplay = lockedDisplayValue(
    lead.verifiedEmails[0] ?? lead.emails[0] ?? lead.email ?? "",
    "contact@business.com"
  );
  const ratingDisplay =
    lead.rating != null
      ? `★ ${lead.rating}${lead.reviews_count != null ? ` (${lead.reviews_count.toLocaleString()} reviews)` : ""}`
      : "n/a";

  return (
    <div
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
        <TrialPhoneValue phone={lead.phone} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ color: "#555575", fontSize: 12, flexShrink: 0 }}>Email</span>
        <LockedContactValue value={emailDisplay} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: "#555575", fontSize: 12, flexShrink: 0 }}>Rating</span>
        <LockedContactValue value={ratingDisplay} />
      </div>
    </div>
  );
}

export default function FreeTrialPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<TrialStatus>("idle");
  const [leads, setLeads] = useState<TrialLead[]>([]);
  const [searchesUsed, setSearchesUsed] = useState(0);
  const [searchesRemaining, setSearchesRemaining] = useState(2);
  const [message, setMessage] = useState("");
  const [showUpgradePanel, setShowUpgradePanel] = useState(false);
  const [searchResultsReady, setSearchResultsReady] = useState(false);
  const [scrolledToResultsEnd, setScrolledToResultsEnd] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [activeSearchLocation, setActiveSearchLocation] = useState("");
  const [gatePassed, setGatePassed] = useState(false);
  const [gateEmail, setGateEmail] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState("");
  const [aggregateStats, setAggregateStats] = useState<TrialAggregateStats>({
    totalFound: 0,
    verifiedEmailCount: 0,
  });
  const [bootstrapping, setBootstrapping] = useState(true);

  const paywallTriggeredRef = useRef(false);
  const enrichmentPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const searchFinishedRef = useRef(false);
  const resultsEndRef = useRef<HTMLDivElement | null>(null);

  const tableSendCount = useMemo(() => sendButtonCount(leads), [leads]);
  const exportCount = leads.length;

  const openUpgrade = useCallback(() => setShowUpgradePanel(true), []);

  const refreshTrialStatus = useCallback(async (email: string) => {
    const trialStatus = await fetchTrialStatus(email);
    if (trialStatus === "not_found") {
      clearTrialSession();
      setGatePassed(false);
      setGateEmail("");
      setStatus("idle");
      setShowUpgradePanel(false);
      setAggregateStats({ totalFound: 0, verifiedEmailCount: 0 });
      return;
    }
    if (!trialStatus) return;
    setSearchesUsed(trialStatus.searchesUsed);
    setSearchesRemaining(trialStatus.searchesRemaining);
    if (trialStatus.searchesRemaining <= 0) {
      setStatus("limit");
      const stats = loadTrialStats();
      if (stats && stats.totalFound > 0) {
        setAggregateStats(stats);
        setShowUpgradePanel(true);
      } else {
        setShowUpgradePanel(false);
      }
    }
  }, []);

  const stopEnrichmentPoll = useCallback(() => {
    if (enrichmentPollRef.current) {
      clearInterval(enrichmentPollRef.current);
      enrichmentPollRef.current = null;
    }
  }, []);

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const resetTrialSession = useCallback(() => {
    clearTrialSession();
    setGatePassed(false);
    setGateEmail("");
    setStatus("idle");
    setLeads([]);
    setSearchesUsed(0);
    setSearchesRemaining(2);
    setShowUpgradePanel(false);
    setSearchResultsReady(false);
    setScrolledToResultsEnd(false);
    setAggregateStats({ totalFound: 0, verifiedEmailCount: 0 });
    setMessage("");
    paywallTriggeredRef.current = false;
    stopEnrichmentPoll();
    closeEventSource();
  }, [stopEnrichmentPoll, closeEventSource]);

  const finishTrialSearch = useCallback(
    async (searchId: string, searchNumber: number, trialEmail: string) => {
      if (searchFinishedRef.current) return;
      searchFinishedRef.current = true;
      stopEnrichmentPoll();
      closeEventSource();

      setStatus(searchNumber >= 2 ? "limit" : "complete");
      setMessage("");

      const stats = await fetchSearchStats(searchId, trialEmail);
      setAggregateStats((prev) => {
        const next = {
          totalFound: prev.totalFound + stats.totalFound,
          verifiedEmailCount: prev.verifiedEmailCount + stats.verifiedEmailCount,
        };
        saveTrialStats(next);
        return next;
      });

      const freshLeads = await fetchVisibleLeads(searchId, trialEmail);
      if (freshLeads.length > 0) {
        setLeads(freshLeads);
      }
    },
    [stopEnrichmentPoll, closeEventSource]
  );

  const startSearchCompletionPoll = useCallback(
    (searchId: string, searchNumber: number, trialEmail: string) => {
      stopEnrichmentPoll();
      searchFinishedRef.current = false;

      const pollOnce = async () => {
        if (searchFinishedRef.current) return;

        const progress = await fetchTrialSearchProgress(searchId, trialEmail);
        if (!progress) return;

        if (progress.leads.length > 0) {
          setLeads(progress.leads);
        }

        if (isSearchReadyForPaywall(progress)) {
          setSearchResultsReady(true);
        }

        if (progress.queuePosition > 0) {
          setMessage(
            `Your search is queued. You are number ${progress.queuePosition} in line.`
          );
        } else if (progress.status === "pending" || progress.status === "running") {
          if (progress.leads.length === 0) {
            setMessage("Scanning for businesses. This can take about 60 seconds...");
          }
        }

        if (progress.status === "failed") {
          searchFinishedRef.current = true;
          stopEnrichmentPoll();
          setStatus("idle");
          setMessage(
            "Search did not complete. Try a broader location or business type."
          );
          return;
        }

        if (progress.status === "completed") {
          if (progress.totalFound === 0 && progress.leads.length === 0) {
            searchFinishedRef.current = true;
            stopEnrichmentPoll();
            setStatus("idle");
            setMessage(
              "No results found. Try a broader search like restaurants in Lagos Nigeria or dentists in London UK."
            );
            return;
          }
          await finishTrialSearch(searchId, searchNumber, trialEmail);
        }
      };

      void pollOnce();
      enrichmentPollRef.current = setInterval(() => {
        void pollOnce();
      }, 3000);
    },
    [stopEnrichmentPoll, finishTrialSearch]
  );

  const connectToStream = useCallback(
    (searchId: string, searchNumber: number, trialEmail: string) => {
      // Trial uses polling only — SSE over QUIC/HTTP3 behind Cloudflare is unreliable.
      startSearchCompletionPoll(searchId, searchNumber, trialEmail);
    },
    [startSearchCompletionPoll]
  );

  useEffect(() => {
    const savedEmail = getTrialEmail();
    if (!savedEmail) {
      setBootstrapping(false);
      return;
    }

    setGateEmail(savedEmail);

    void (async () => {
      const trialStatus = await fetchTrialStatus(savedEmail);
      if (trialStatus === "not_found") {
        resetTrialSession();
        setBootstrapping(false);
        return;
      }
      if (!trialStatus) {
        setGatePassed(false);
        setBootstrapping(false);
        return;
      }

      setSearchesUsed(trialStatus.searchesUsed);
      setSearchesRemaining(trialStatus.searchesRemaining);

      if (trialStatus.searchesRemaining <= 0) {
        const stats = loadTrialStats();
        resetTrialSession();
        setMessage(
          stats && stats.totalFound > 0
            ? "That email has already used both free searches."
            : "That email has already used both free searches. Enter a different email below to run a fresh trial."
        );
        setBootstrapping(false);
        return;
      }

      const savedStats = loadTrialStats();
      if (savedStats) {
        setAggregateStats(savedStats);
      }
      setGatePassed(true);
      setBootstrapping(false);
    })();

    return () => {
      stopEnrichmentPoll();
      closeEventSource();
    };
  }, [resetTrialSession, stopEnrichmentPoll, closeEventSource]);

  useEffect(() => {
    if (status !== "searching") return;
    if (message.includes("queued") || message.includes("in line")) return;

    const progressMessages = [
      `Scanning for ${query} in ${location}...`,
      "Extracting business details...",
      "Collecting phone numbers and addresses...",
      "Finding verified email addresses...",
      "Almost done. Finalizing results...",
    ];

    let msgIndex = 0;
    const interval = setInterval(() => {
      msgIndex = Math.min(msgIndex + 1, progressMessages.length - 1);
      setMessage(progressMessages[msgIndex]);
    }, 3000);

    return () => clearInterval(interval);
  }, [status, query, location, message]);

  useEffect(() => {
    if (!searchResultsReady || !scrolledToResultsEnd || paywallTriggeredRef.current) {
      return;
    }
    paywallTriggeredRef.current = true;
    setShowUpgradePanel(true);
  }, [searchResultsReady, scrolledToResultsEnd]);

  useEffect(() => {
    const sentinel = resultsEndRef.current;
    if (!sentinel || !searchResultsReady) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setScrolledToResultsEnd(true);
        }
      },
      { root: null, threshold: 0.6 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [searchResultsReady, leads.length]);

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
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(
            body.error || "Too many requests from your network. Please wait a minute and try again."
          );
        }
        throw new Error(body.error || "Signup failed");
      }

      const trialStatus = await fetchTrialStatus(email);
      if (
        trialStatus &&
        trialStatus !== "not_found" &&
        trialStatus.searchesRemaining <= 0
      ) {
        clearTrialSession();
        setGatePassed(false);
        setGateError(
          "This email has already used both free searches. Enter a different email or upgrade for full access."
        );
        return;
      }

      setTrialEmail(email);
      setGatePassed(true);
      setSearchesUsed(0);
      setSearchesRemaining(2);
      void refreshTrialStatus(email);
    } catch (err) {
      setGateError(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setGateLoading(false);
    }
  }

  async function runTrialSearch() {
    if (!query.trim() || !location.trim()) return;

    const trialEmail = getTrialEmail();
    if (!trialEmail) {
      setGatePassed(false);
      setMessage("Enter your email to start your free trial.");
      return;
    }

    if (searchesRemaining <= 0) {
      setStatus("limit");
      setShowUpgradePanel(true);
      return;
    }

    const apiUrl = getApiUrl();
    if (!apiUrl) {
      setMessage("Search service is not configured.");
      return;
    }

    const nextSearchNumber = searchesUsed + 1;
    const trimmedQuery = query.trim();
    const trimmedLocation = location.trim();

    setStatus("searching");
    setLeads([]);
    setSearchResultsReady(false);
    setScrolledToResultsEnd(false);
    paywallTriggeredRef.current = false;
    setShowUpgradePanel(false);
    setActiveSearchQuery(trimmedQuery);
    setActiveSearchLocation(trimmedLocation);
    setMessage(`Scanning for ${trimmedQuery} in ${trimmedLocation}...`);

    try {
      const res = await fetch(`${apiUrl}/freetrial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmedQuery,
          location: trimmedLocation,
          email: trialEmail,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        searchId?: string;
        searchesUsed?: number;
        searchesRemaining?: number;
      };

      if (res.status === 403 && body.code === "TRIAL_GATE_REQUIRED") {
        setGatePassed(false);
        setMessage("Enter your email to start your free trial.");
        return;
      }

      if (res.status === 429 && (body.code === "TRIAL_LIMIT" || body.code === "TRIAL_IP_LIMIT")) {
        if (typeof body.searchesUsed === "number") {
          setSearchesUsed(body.searchesUsed);
        }
        setSearchesRemaining(0);
        setStatus("limit");
        setShowUpgradePanel(true);
        return;
      }

      if (res.status === 429) {
        setMessage(
          body.error || "Too many requests from your network. Please wait a minute and try again."
        );
        setStatus("idle");
        return;
      }

      if (!res.ok) {
        throw new Error(body.error || "Search failed");
      }

      if (typeof body.searchesUsed === "number") {
        setSearchesUsed(body.searchesUsed);
      }
      if (typeof body.searchesRemaining === "number") {
        setSearchesRemaining(body.searchesRemaining);
      }

      if (!body.searchId) {
        throw new Error("Search failed");
      }

      connectToStream(body.searchId, nextSearchNumber, trialEmail);
      void refreshTrialStatus(trialEmail);
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

  const bottomPad = showUpgradePanel ? 420 : 40;

  return (
    <div
      className="min-h-screen text-[#F0EFFF]"
      style={{
        background: "#06060A",
        fontFamily: FONT_STACK,
        paddingBottom: bottomPad,
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
          href={CHECKOUT_URL}
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
        {bootstrapping && gatePassed ? (
          <div
            className="text-center rounded-2xl py-12 px-6"
            style={{
              background: "#111118",
              border: "1px solid rgba(124,58,237,0.25)",
              color: "#7878A0",
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                border: "2px solid rgba(124,58,237,0.3)",
                borderTop: "2px solid #A78BFA",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.8s linear infinite",
                marginBottom: 12,
              }}
            />
            <p style={{ margin: 0, fontSize: 14 }}>Loading your free trial...</p>
          </div>
        ) : !gatePassed ? (
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
            {message && !gateError && (
              <p className="text-sm mb-2" style={{ color: "#A78BFA" }}>
                {message}
              </p>
            )}
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
                {searchesRemaining === 2 ? "2 free searches left" : "1 free search left"}
              </div>
            )}

            {status === "limit" && (
              <section
                className="mb-8 rounded-2xl p-6 text-center"
                style={{
                  background: "#111118",
                  border: "1px solid rgba(124,58,237,0.25)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#F0EFFF",
                    lineHeight: 1.5,
                  }}
                >
                  You have used both free searches. Lifetime access lets you keep building your
                  pipeline with full emails, phone numbers, and one click outreach.
                </p>
                <button
                  type="button"
                  onClick={openUpgrade}
                  style={{
                    ...tapTarget,
                    width: "100%",
                    maxWidth: 420,
                    margin: "0 auto 12px",
                    display: "block",
                    background: "#7C3AED",
                    color: "#fff",
                    fontWeight: 800,
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                    boxShadow: "0 0 40px rgba(124,58,237,0.4)",
                  }}
                >
                  Get lifetime access for ${SALE_PRICE_USD}
                </button>
                <button
                  type="button"
                  onClick={resetTrialSession}
                  style={{
                    ...tapTarget,
                    width: "100%",
                    maxWidth: 420,
                    margin: "0 auto",
                    display: "block",
                    background: "transparent",
                    color: "#9CA3AF",
                    fontWeight: 600,
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 14,
                  }}
                >
                  Start fresh with a different email
                </button>
              </section>
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
                    boxShadow: status === "searching" ? "none" : "0 0 40px rgba(124,58,237,0.4)",
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
                    Send email to {tableSendCount} businesses, locked
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
                    Export {exportCount} rows, locked
                  </button>
                </div>

                <div className="flex flex-col gap-2 md:hidden">
                  {leads.map((lead) => (
                    <LeadRowMobile key={lead.id} lead={lead} />
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
                  {leads.map((lead, i) => {
                    const emailDisplay = lockedDisplayValue(
                      lead.verifiedEmails[0] ?? lead.emails[0] ?? lead.email ?? "",
                      "contact@business.com"
                    );
                    const ratingDisplay =
                      lead.rating != null ? `★ ${lead.rating}` : "n/a";

                    return (
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
                          <TrialPhoneValue phone={lead.phone} />
                        </span>
                        <span>
                          <LockedContactValue value={emailDisplay} />
                        </span>
                        <span>
                          <LockedContactValue value={ratingDisplay} />
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div ref={resultsEndRef} style={{ height: 1, width: "100%" }} aria-hidden />
              </section>
            )}
          </>
        )}
      </main>

      <footer
        className="text-center text-xs py-8 px-4 border-t"
        style={{ borderColor: "rgba(255,255,255,0.06)", color: "#555575" }}
      >
        <a
          href={SITE_URL}
          className="hover:text-[#7878A0]"
          style={{ minHeight: 48, display: "inline-flex", alignItems: "center" }}
        >
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
              maxHeight: "min(78vh, 560px)",
              overflowY: "auto",
            }}
          >
            <p style={{ fontSize: 20, fontWeight: 800, color: "#F0EFFF", lineHeight: 1.35, margin: "0 0 16px" }}>
              {PAYWALL_HEADING}
            </p>

            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#A78BFA",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              What you are getting
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
              {PAYWALL_TIER_ONE.map((item) => (
                <PaywallValueRow key={item.label} label={item.label} compareAt={item.compareAt} />
              ))}
            </ul>

            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#34D399",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              Included when you claim a slot today
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
              {PAYWALL_TIER_TWO.map((item) => (
                <PaywallValueRow key={item} label={item} free />
              ))}
            </ul>

            <div style={{ margin: "0 0 16px", textAlign: "center" }}>
              <p style={{ margin: "0 0 6px", fontSize: 14, color: "#7878A0" }}>
                <span style={{ textDecoration: "line-through", marginRight: 8 }}>Total value $300</span>
              </p>
              <p style={{ margin: "0 0 10px", fontSize: 14, color: "#7878A0" }}>
                <span style={{ textDecoration: "line-through" }}>$100 per year</span>
              </p>
              <p style={{ margin: 0, fontSize: 34, fontWeight: 900, color: "#F0EFFF", lineHeight: 1.1 }}>
                ${SALE_PRICE_USD}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 700, color: "#C0C0D8" }}>
                Once. Never again.
              </p>
            </div>

            <a
              href={CHECKOUT_URL}
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
              Get lifetime access for ${SALE_PRICE_USD}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
