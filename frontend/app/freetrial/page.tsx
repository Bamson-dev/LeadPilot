"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import type { BusinessLead } from "@leadthur/shared";
import {
  TRIAL_SEARCH_EXAMPLES,
  validateTrialSearchInput,
  type TrialSearchSuggestion,
} from "@leadthur/shared";
import { isSearchFullyComplete } from "@/utils/search-completion";
import { getApiUrl } from "@/utils/env";
import { SALE_PRICE_USD } from "@/constants/pricing";
import { TRIAL_EMAIL_KEY } from "@/constants/trial";
import { PublicFunnelShell } from "@/components/public/public-funnel-shell";
import { track } from "@/lib/analytics";
import {
  LeadRowMobile,
  LockIcon,
  StarRating,
  TrialExamplePills,
  TrialPaywallPanel,
  TrialResultsTable,
  TrialSearchGuidance,
  TrialSearchHint,
  TrialSearchProgress,
  type TrialLeadRow,
} from "@/components/public/freetrial/trial-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelContent } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

const MAX_TRIAL_LEADS = 15;
const CHECKOUT_URL = "/checkout";
const TRIAL_STATS_KEY = "lp_trial_stats";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAYWALL_SENTINEL_INDEX = 9;
const PAYWALL_MIN_SAMPLE_LEADS = 10;
const PAYWALL_SCROLL_DELAY_MS = 2000;
const PAYWALL_MIN_DWELL_MS = 4000;

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

type TrialLead = TrialLeadRow;

interface TrialAggregateStats {
  totalFound: number;
  verifiedEmailCount: number;
}

function isSearchReadyForPaywall(progress: {
  status: string;
  leads: TrialLead[];
  totalFound: number;
  emailScrapingComplete: boolean;
  scrapingInProgress?: boolean;
  fullyComplete?: boolean;
}): boolean {
  if (
    !isSearchFullyComplete({
      fullyComplete: progress.fullyComplete,
      status: progress.status,
      scrapingInProgress: progress.scrapingInProgress,
      emailScrapingComplete: progress.emailScrapingComplete,
    })
  ) {
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
  scrapingInProgress: boolean;
  fullyComplete: boolean;
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
      scrapingInProgress?: boolean;
      fullyComplete?: boolean;
    };
    const rows = data.leads ?? [];
    let verifiedEmailCount = 0;
    for (const lead of rows) {
      if ((lead.verifiedEmails?.length ?? 0) > 0) verifiedEmailCount++;
    }
    const status = data.status ?? "pending";
    const scrapingInProgress = Boolean(data.scrapingInProgress);
    const emailScrapingComplete = Boolean(data.emailScrapingComplete);
    return {
      status,
      leads: rows.map(normalizeLead).slice(0, MAX_TRIAL_LEADS),
      totalFound: data.totalFound ?? data.total ?? rows.length,
      queuePosition: data.queuePosition ?? 0,
      verifiedEmailCount,
      emailScrapingComplete,
      scrapingInProgress,
      fullyComplete: isSearchFullyComplete({
        fullyComplete: data.fullyComplete,
        status,
        scrapingInProgress,
        emailScrapingComplete,
      }),
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
  const [activeSearchTotalFound, setActiveSearchTotalFound] = useState(0);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [activeSearchLocation, setActiveSearchLocation] = useState("");
  const [gatePassed, setGatePassed] = useState(false);
  const [gateEmail, setGateEmail] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState("");
  const [, setAggregateStats] = useState<TrialAggregateStats>({
    totalFound: 0,
    verifiedEmailCount: 0,
  });
  const [bootstrapping, setBootstrapping] = useState(true);
  const [searchHint, setSearchHint] = useState<{
    message: string;
    suggestion?: TrialSearchSuggestion;
  } | null>(null);
  const [paywallSentinelVisible, setPaywallSentinelVisible] = useState(false);

  const paywallTriggeredRef = useRef(false);
  const paywallSentinelMobileRef = useRef<HTMLDivElement | null>(null);
  const paywallSentinelDesktopRef = useRef<HTMLDivElement | null>(null);
  const resultsReadyAtRef = useRef<number | null>(null);
  const enrichmentPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const searchFinishedRef = useRef(false);

  const tableSendCount = useMemo(() => sendButtonCount(leads), [leads]);
  const exportCount = leads.length;
  const businessesFoundCount = useMemo(
    () => Math.max(activeSearchTotalFound, leads.length),
    [activeSearchTotalFound, leads.length]
  );
  const paywallSentinelIndex = useMemo(
    () => Math.min(PAYWALL_SENTINEL_INDEX, Math.max(leads.length - 1, 0)),
    [leads.length]
  );

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
    setActiveSearchTotalFound(0);
    setAggregateStats({ totalFound: 0, verifiedEmailCount: 0 });
    setMessage("");
    paywallTriggeredRef.current = false;
    resultsReadyAtRef.current = null;
    setPaywallSentinelVisible(false);
    setSearchHint(null);
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
      if (stats.totalFound > 0) {
        setActiveSearchTotalFound(stats.totalFound);
      }
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

        if (progress.totalFound > 0) {
          setActiveSearchTotalFound(progress.totalFound);
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
            setMessage("Searching Google Maps...");
          }
        }

        if (progress.status === "failed") {
          searchFinishedRef.current = true;
          stopEnrichmentPoll();
          setStatus("idle");
          setMessage("");
          setSearchHint({
            message:
              "No businesses found for that search. Use one business type in one city so you can test the tool properly.",
            suggestion: TRIAL_SEARCH_EXAMPLES[0],
          });
          return;
        }

        if (isSearchFullyComplete(progress)) {
          if (progress.totalFound === 0 && progress.leads.length === 0) {
            searchFinishedRef.current = true;
            stopEnrichmentPoll();
            setStatus("idle");
            setMessage("");
            setSearchHint({
              message:
                "No results found. Try one business type in one city — e.g. restaurants in London UK.",
              suggestion: TRIAL_SEARCH_EXAMPLES[0],
            });
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
      "Searching Google Maps...",
      "Collecting businesses...",
      "Checking websites...",
      "Finding email addresses...",
      "Preparing results...",
    ];

    let msgIndex = 0;
    const interval = setInterval(() => {
      msgIndex = Math.min(msgIndex + 1, progressMessages.length - 1);
      setMessage(progressMessages[msgIndex]);
    }, 3000);

    return () => clearInterval(interval);
  }, [status, query, location, message]);

  useEffect(() => {
    if (searchResultsReady) {
      if (resultsReadyAtRef.current === null) {
        resultsReadyAtRef.current = Date.now();
      }
    } else {
      resultsReadyAtRef.current = null;
    }
  }, [searchResultsReady]);

  useEffect(() => {
    const nodes = [paywallSentinelMobileRef.current, paywallSentinelDesktopRef.current].filter(
      Boolean
    ) as HTMLDivElement[];

    if (nodes.length === 0 || !searchResultsReady || leads.length === 0) {
      setPaywallSentinelVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setPaywallSentinelVisible(entries.some((entry) => entry.isIntersecting));
      },
      { threshold: 0.25 }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [searchResultsReady, leads.length, paywallSentinelIndex]);

  useEffect(() => {
    if (!searchResultsReady || paywallTriggeredRef.current || leads.length === 0) {
      return;
    }

    const showPaywall = () => {
      if (paywallTriggeredRef.current) return;
      paywallTriggeredRef.current = true;
      setShowUpgradePanel(true);
      track("paywall_viewed", {
        properties: { leads: leads.length },
        idempotencyKey: `paywall_viewed:${getTrialEmail() || "anon"}:${Math.floor(Date.now() / 60_000)}`,
      });
    };

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Path A: user has scrolled into ~10 visible rows
    if (leads.length >= PAYWALL_MIN_SAMPLE_LEADS && paywallSentinelVisible) {
      timers.push(setTimeout(showPaywall, PAYWALL_SCROLL_DELAY_MS));
    }

    // Path B: minimum dwell time so first rows stay unobstructed
    if (leads.length >= PAYWALL_MIN_SAMPLE_LEADS && resultsReadyAtRef.current) {
      const elapsed = Date.now() - resultsReadyAtRef.current;
      const wait = Math.max(PAYWALL_MIN_DWELL_MS - elapsed, PAYWALL_SCROLL_DELAY_MS);
      timers.push(setTimeout(showPaywall, wait));
    }

    // Path C: smaller samples — still wait until user views the results list
    if (leads.length > 0 && leads.length < PAYWALL_MIN_SAMPLE_LEADS && paywallSentinelVisible) {
      timers.push(setTimeout(showPaywall, PAYWALL_SCROLL_DELAY_MS + 500));
    }

    return () => timers.forEach(clearTimeout);
  }, [searchResultsReady, leads.length, paywallSentinelVisible]);

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
      track("trial_email_submitted", {
        userEmail: email,
        idempotencyKey: `trial_email_submitted:${email}`,
      });
      track("trial_started", {
        userEmail: email,
        idempotencyKey: `trial_started:${email}`,
      });
      track("freetrial_viewed", {
        userEmail: email,
        idempotencyKey: `freetrial_viewed:${email}`,
      });
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

    const validation = validateTrialSearchInput(trimmedQuery, trimmedLocation);
    if (!validation.ok) {
      setSearchHint({
        message: validation.message,
        suggestion: validation.suggestion,
      });
      setMessage("");
      setStatus("idle");
      return;
    }

    setSearchHint(null);
    setStatus("searching");
    setLeads([]);
    setSearchResultsReady(false);
    setActiveSearchTotalFound(0);
    paywallTriggeredRef.current = false;
    resultsReadyAtRef.current = null;
    setPaywallSentinelVisible(false);
    setShowUpgradePanel(false);
    setActiveSearchQuery(trimmedQuery);
    setActiveSearchLocation(trimmedLocation);
    setMessage("Searching Google Maps...");

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
        hint?: TrialSearchSuggestion;
      };

      if (res.status === 400 && body.code === "TRIAL_SEARCH_INVALID") {
        setSearchHint({
          message: body.error || "That search format will not work on Google Maps.",
          suggestion: body.hint ?? TRIAL_SEARCH_EXAMPLES[0],
        });
        setMessage("");
        setStatus("idle");
        return;
      }

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

  function applyTrialSuggestion(suggestion: TrialSearchSuggestion) {
    setQuery(suggestion.query);
    setLocation(suggestion.location);
    setSearchHint(null);
    setMessage("");
  }

  const bottomPad = showUpgradePanel ? 420 : 40;

  return (
    <PublicFunnelShell bottomPad={bottomPad} showFooter={!showUpgradePanel}>
        {bootstrapping && gatePassed ? (
          <Panel className="py-12 text-center">
            <PanelContent className="flex flex-col items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <p className="m-0 text-sm text-[var(--lt-text-muted)]">Loading your free trial...</p>
            </PanelContent>
          </Panel>
        ) : !gatePassed ? (
          <Panel className="mx-auto max-w-md text-center">
            <PanelContent className="space-y-5 p-6 md:p-8">
              <StarRating />
              <p className="m-0 text-base leading-relaxed text-[var(--lt-text-muted)] md:text-lg">
                Type one business type and one city. Get real businesses with phone numbers
                and email addresses in about 60 seconds. Twice, free.
              </p>
              <Input
                type="email"
                placeholder="your@email.com"
                value={gateEmail}
                onChange={(e) => setGateEmail(e.target.value)}
                disabled={gateLoading}
                className="min-h-12 text-base"
                onKeyDown={(e) => e.key === "Enter" && void handleGateSubmit()}
              />
              {gateError ? (
                <Alert variant="danger">
                  <AlertDescription>{gateError}</AlertDescription>
                </Alert>
              ) : null}
              {message && !gateError ? (
                <p className="m-0 text-sm text-[var(--lt-accent-soft)]">{message}</p>
              ) : null}
              <Button
                type="button"
                size="lg"
                className="h-12 w-full text-base font-extrabold"
                onClick={() => void handleGateSubmit()}
                disabled={gateLoading || !gateEmail.trim()}
              >
                {gateLoading ? "Starting..." : "Start My 2 Free Searches"}
              </Button>
              <p className="m-0 text-xs text-[var(--lt-text-subtle)]">
                No card. No spam. Two searches, then you decide.
              </p>
            </PanelContent>
          </Panel>
        ) : (
          <>
            {searchesRemaining > 0 && status !== "limit" && (
              <Alert className="mb-6 border-[var(--lt-accent)]/25 bg-[var(--lt-accent)]/10 text-center">
                <AlertDescription className="font-semibold text-[var(--lt-accent-soft)]">
                  {searchesRemaining === 2 ? "2 free searches left" : "1 free search left"}
                </AlertDescription>
              </Alert>
            )}

            {status === "limit" && (
              <Panel className="mb-8 text-center">
                <PanelContent className="space-y-4 p-6">
                  <p className="m-0 text-base font-bold leading-relaxed text-[var(--lt-text)]">
                    You have used both free searches. Lifetime access lets you keep building your
                    pipeline with full emails, phone numbers, and one click outreach.
                  </p>
                  <Button size="lg" className="mx-auto h-12 w-full max-w-md font-extrabold" onClick={openUpgrade}>
                    Unlock Every Business Now
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="mx-auto h-12 w-full max-w-md"
                    onClick={resetTrialSession}
                  >
                    Start fresh with a different email
                  </Button>
                </PanelContent>
              </Panel>
            )}

            {status !== "limit" && (
              <>
                <TrialSearchGuidance />

                <Panel className="mb-4">
                  <PanelContent className="space-y-3 p-4">
                    <label className="text-xs font-semibold text-[var(--lt-text-muted)]">
                      Business type
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. restaurants, dentists, gyms"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        if (searchHint) setSearchHint(null);
                      }}
                      disabled={status === "searching"}
                      className="min-h-12"
                      onKeyDown={(e) => e.key === "Enter" && void runTrialSearch()}
                    />
                    <label className="text-xs font-semibold text-[var(--lt-text-muted)]">
                      City or area
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. London UK, Dubai UAE"
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        if (searchHint) setSearchHint(null);
                      }}
                      disabled={status === "searching"}
                      className="min-h-12"
                      onKeyDown={(e) => e.key === "Enter" && void runTrialSearch()}
                    />
                  </PanelContent>
                </Panel>

                <Button
                  type="button"
                  size="lg"
                  className="h-12 w-full gap-2 text-base font-extrabold"
                  onClick={() => void runTrialSearch()}
                  disabled={status === "searching" || !query.trim() || !location.trim()}
                >
                  {status === "searching" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Searching...
                    </>
                  ) : (
                    "Run free search"
                  )}
                </Button>

                {searchHint ? (
                  <TrialSearchHint
                    message={searchHint.message}
                    suggestion={searchHint.suggestion}
                    onApply={applyTrialSuggestion}
                  />
                ) : null}

                <TrialSearchProgress
                  message={message}
                  businessesFound={businessesFoundCount}
                  searching={status === "searching"}
                />

                {status !== "searching" && (
                  <TrialExamplePills onSelect={applyTrialSuggestion} />
                )}
              </>
            )}

            {leads.length > 0 && (
              <section className="mt-8">
                <div className="mb-4 flex flex-col gap-2 md:flex-row">
                  <Button
                    type="button"
                    variant="soft"
                    className="min-h-12 flex-1"
                    onClick={openUpgrade}
                  >
                    <LockIcon />
                    Send email to {tableSendCount} businesses, locked
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12 flex-1"
                    onClick={openUpgrade}
                  >
                    <LockIcon />
                    Export {exportCount} rows, locked
                  </Button>
                </div>

                <div className="flex flex-col gap-2 md:hidden">
                  {leads.map((lead, index) => (
                    <Fragment key={lead.id}>
                      <LeadRowMobile lead={lead} />
                      {index === paywallSentinelIndex ? (
                        <div ref={paywallSentinelMobileRef} className="h-px w-full" aria-hidden />
                      ) : null}
                    </Fragment>
                  ))}
                </div>

                <TrialResultsTable
                  leads={leads}
                  lockedDisplayValue={lockedDisplayValue}
                  truncateAddress={truncateAddress}
                  paywallSentinelRef={paywallSentinelDesktopRef}
                  paywallSentinelAfterIndex={paywallSentinelIndex}
                />
              </section>
            )}
          </>
        )}
      <TrialPaywallPanel
        visible={showUpgradePanel && gatePassed}
        visibleSampleCount={leads.length}
        tierOne={PAYWALL_TIER_ONE}
        tierTwo={PAYWALL_TIER_TWO}
        salePriceUsd={SALE_PRICE_USD}
        checkoutUrl={CHECKOUT_URL}
      />
    </PublicFunnelShell>
  );
}
