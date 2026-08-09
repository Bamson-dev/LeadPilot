import { getApiUrl } from "@/utils/env";

const TOKEN_KEY = "leadthur_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function getAdminHeaders(): HeadersInit {
  const token = getAdminToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleAdminResponse(res: Response): Promise<void> {
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
}

export interface AdminQueueStatus {
  active: number;
  waiting: number;
  failedLast24h: number;
  mode: "bullmq" | "inline";
}

export async function getAdminQueueStatus(): Promise<AdminQueueStatus> {
  const res = await fetch(`${getApiUrl()}/admin/queue-status`, {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load queue status");
  return (await res.json()) as AdminQueueStatus;
}

export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${getApiUrl()}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Invalid credentials");
  }
  return res.json() as Promise<{ token: string; expiresIn: string; email: string }>;
}

export async function generateAccess(email: string) {
  const res = await fetch(`${getApiUrl()}/admin/generate-access`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ email }),
  });
  await handleAdminResponse(res);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to generate access");
  }
  return res.json();
}

export async function resendAccess(email: string) {
  const res = await fetch(`${getApiUrl()}/admin/resend-access`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ email }),
  });
  await handleAdminResponse(res);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to resend access");
  }
  return res.json();
}

export interface AdminLicense {
  id: string;
  email: string;
  key: string;
  activated: boolean;
  activated_at: string | null;
  payment_channel: string;
  payment_reference: string | null;
  searches_used: number;
  exports_used: number;
  search_count?: number;
  monthly_search_limit?: number;
  export_count?: number;
  is_suspended?: boolean;
  suspension_reason?: string | null;
  max_devices?: number;
  search_credits?: number;
  device_one?: string | null;
  device_two?: string | null;
  device_three?: string | null;
  device_four?: string | null;
  last_reset_at?: string | null;
  created_at: string;
}

export async function lookupLicense(email: string): Promise<{ licenses: AdminLicense[] } | null> {
  const res = await fetch(
    `${getApiUrl()}/admin/lookup?email=${encodeURIComponent(email)}`,
    { headers: getAdminHeaders() }
  );
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Lookup failed");
  return res.json();
}

export async function updateSearchLimit(
  email: string,
  newLimit: number
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/admin/update-limit`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify({ email, newLimit }),
    });

    const data = (await res.json()) as { error?: string; message?: string };

    if (res.status === 401) {
      return { success: false, error: "SESSION_EXPIRED" };
    }

    if (!res.ok) {
      return { success: false, error: data.error || "Failed to update search limit" };
    }

    return { success: true, message: data.message };
  } catch {
    return { success: false, error: "Network error. Check your connection." };
  }
}

export async function suspendAccount(email: string, reason: string) {
  const res = await fetch(`${getApiUrl()}/admin/suspend`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ email, reason }),
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to suspend");
  return res.json();
}

export async function unsuspendAccount(email: string) {
  const res = await fetch(`${getApiUrl()}/admin/unsuspend`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ email }),
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to unsuspend");
  return res.json();
}

export async function resetSearches(email: string) {
  const res = await fetch(`${getApiUrl()}/admin/reset-searches`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ email }),
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to reset searches");
  return res.json();
}

export async function getLicenses(): Promise<{ licenses: AdminLicense[] }> {
  const res = await fetch(`${getApiUrl()}/admin/licenses`, {
    headers: getAdminHeaders(),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error("Failed to fetch licenses");
  return res.json();
}

export interface AdminStats {
  totalLicenses: number;
  activatedLicenses: number;
  totalSearches: number;
  licensesToday: number;
}

export interface AdminOverview {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  totalSearches: number;
  totalTrialSearches: number;
  estimatedRevenue: number;
}

export interface RecentAdminUser {
  email: string;
  activated: boolean;
  is_suspended: boolean;
  created_at: string;
  searches_used: number;
  max_devices: number;
}

export async function getOverview(): Promise<AdminOverview> {
  const res = await fetch(`${getApiUrl()}/admin/overview`, {
    headers: getAdminHeaders(),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error("Failed to fetch overview");
  return res.json();
}

export async function getRecentUsers(): Promise<{ users: RecentAdminUser[] }> {
  const res = await fetch(`${getApiUrl()}/admin/recent-users`, {
    headers: getAdminHeaders(),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error("Failed to fetch recent users");
  return res.json();
}

export interface PayoutRequest {
  id: string;
  referrer_email: string;
  amount_ngn: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: string;
  created_at: string;
  failure_reason?: string | null;
}

export async function getPayouts(): Promise<{ payouts: PayoutRequest[] }> {
  const res = await fetch(`${getApiUrl()}/admin/payouts`, {
    headers: getAdminHeaders(),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error("Failed to fetch payouts");
  return res.json();
}

export async function markPayoutProcessing(payoutId: string) {
  const res = await fetch(`${getApiUrl()}/admin/payouts/${payoutId}/processing`, {
    method: "POST",
    headers: getAdminHeaders(),
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to update payout status");
  return res.json() as Promise<{ success: boolean; message: string }>;
}

export async function payPayout(payoutId: string) {
  const res = await fetch(`${getApiUrl()}/admin/payouts/${payoutId}/pay`, {
    method: "POST",
    headers: getAdminHeaders(),
  });
  await handleAdminResponse(res);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Payout failed");
  }
  return res.json() as Promise<{ success: boolean; message: string }>;
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await fetch(`${getApiUrl()}/admin/stats`, {
    headers: getAdminHeaders(),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export interface TrialStats {
  totalTrials: number;
  trialsToday: number;
  trialsThisWeek: number;
  trialsThisMonth: number;
  licensesToday: number;
  licensesThisWeek: number;
  conversionRate: string;
}

export interface TrialActivity {
  recentTrials: Array<{
    id: string;
    query: string;
    location: string;
    total_found: number;
    status: string;
    created_at: string;
  }>;
  topQueries: Array<{ query: string; count: number }>;
  dailyActivity: Array<{ date: string; count: number }>;
}

export interface BroadcastCountResponse {
  audience: "unconverted" | "all";
  recipients: number;
}

export interface BroadcastHistoryRow {
  id: string;
  subject: string;
  audience: "unconverted" | "all";
  recipient_count: number;
  sent_at: string;
  sent_by: string;
}

export async function getTrialStats(): Promise<TrialStats> {
  const res = await fetch(`${getApiUrl()}/admin/trial-stats`, {
    headers: getAdminHeaders(),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error("Failed to fetch trial stats");
  return res.json();
}

export async function getTrialActivity(): Promise<TrialActivity> {
  const res = await fetch(`${getApiUrl()}/admin/trial-activity`, {
    headers: getAdminHeaders(),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error("Failed to fetch trial activity");
  return res.json();
}

export async function getBroadcastCount(
  audience: "unconverted" | "all"
): Promise<BroadcastCountResponse> {
  const res = await fetch(`${getApiUrl()}/admin/broadcast-count?audience=${audience}`, {
    headers: getAdminHeaders(),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error("Failed to fetch broadcast count");
  return res.json();
}

export async function sendTrialBroadcast(payload: {
  subject: string;
  body: string;
  audience: "unconverted" | "all";
}): Promise<{ success: boolean; recipients: number; message: string }> {
  const res = await fetch(`${getApiUrl()}/admin/broadcast`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to send broadcast");
  }
  return res.json();
}

export async function getBroadcastHistory(): Promise<{ broadcasts: BroadcastHistoryRow[] }> {
  const res = await fetch(`${getApiUrl()}/admin/broadcast-history`, {
    headers: getAdminHeaders(),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error("Failed to fetch broadcast history");
  return res.json();
}

export interface TrialSignupRow {
  email: string;
  signed_up_at: string;
  searches_used: number;
  converted: boolean;
  converted_at: string | null;
  sequence_step: number;
}

export interface EmailPerformanceRow {
  step: number;
  sends: number;
  opens: number;
  open_rate: number | null;
  last_opened_at: string | null;
}

export interface EmailPerformanceResponse {
  total_signups: number;
  rows: EmailPerformanceRow[];
}

export async function getTrialSignups(): Promise<{
  total: number;
  signups: TrialSignupRow[];
}> {
  const res = await fetch(`${getApiUrl()}/admin/trial-signups`, {
    headers: getAdminHeaders(),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error("Failed to fetch trial signups");
  return res.json();
}

export async function getEmailPerformance(): Promise<EmailPerformanceResponse> {
  const res = await fetch(`${getApiUrl()}/admin/email-performance`, {
    headers: getAdminHeaders(),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error("Failed to fetch email performance");
  return res.json();
}

export async function resetDevices(
  email: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/admin/reset-devices`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify({ email }),
    });

    const data = (await res.json()) as { error?: string; message?: string };

    if (res.status === 401) {
      return { success: false, error: "SESSION_EXPIRED" };
    }

    if (!res.ok) {
      return { success: false, error: data.error || "Failed to reset devices" };
    }

    return { success: true, message: data.message };
  } catch {
    return { success: false, error: "Network error. Check your connection." };
  }
}

export async function upgradeDevices(
  email: string,
  maxDevices: number
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/admin/upgrade-devices`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify({ email, maxDevices }),
    });

    const data = (await res.json()) as { error?: string; message?: string };

    if (res.status === 401) {
      return { success: false, error: "SESSION_EXPIRED" };
    }

    if (!res.ok) {
      return { success: false, error: data.error || "Failed to upgrade devices" };
    }

    return { success: true, message: data.message };
  } catch {
    return { success: false, error: "Network error. Check your connection." };
  }
}

export async function updateDeviceLimit(email: string, maxDevices: number) {
  const res = await fetch(`${getApiUrl()}/admin/update-device-limit`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ email, maxDevices }),
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to update device limit");
  return res.json() as Promise<{ success: boolean; message?: string }>;
}

export async function sendMessage(email: string, subject: string, htmlBody: string) {
  const res = await fetch(`${getApiUrl()}/admin/send-message`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ email, subject, htmlBody }),
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to send message");
  return res.json() as Promise<{ success: boolean; message?: string }>;
}

export async function sendBroadcast(subject: string, htmlBody: string) {
  const res = await fetch(`${getApiUrl()}/admin/broadcast-message`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ subject, htmlBody }),
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to send broadcast");
  return res.json() as Promise<{ success: boolean; message?: string; count?: number }>;
}

function observabilityUrl(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(`${getApiUrl()}/admin/observability${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function getObservabilityOverview(from?: string, to?: string) {
  const res = await fetch(observabilityUrl("/overview", { from, to }), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load observability overview");
  return res.json() as Promise<{
    from: string;
    to: string;
    counts: Record<string, number>;
    openAlerts: number;
    note?: string;
  }>;
}

export async function getObservabilityFunnels(from?: string, to?: string) {
  const res = await fetch(observabilityUrl("/funnels", { from, to }), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load funnels");
  return res.json() as Promise<{
    from: string;
    to: string;
    steps: Array<{ step: string; count: number; conversionFromPrev: number }>;
  }>;
}

export async function getObservabilityEvents(params?: {
  from?: string;
  to?: string;
  eventName?: string;
  category?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await fetch(
    observabilityUrl("/events", {
      from: params?.from,
      to: params?.to,
      eventName: params?.eventName,
      category: params?.category,
      q: params?.q,
      limit: params?.limit,
      offset: params?.offset,
    }),
    { headers: getAdminHeaders(), cache: "no-store" }
  );
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load events");
  return res.json() as Promise<{
    events: Array<Record<string, unknown>>;
    total: number;
    limit: number;
    offset: number;
  }>;
}

export async function getObservabilitySearches(from?: string, to?: string) {
  const res = await fetch(observabilityUrl("/searches", { from, to }), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load search observability");
  return res.json() as Promise<{
    summary: { started: number; completed: number; failed: number };
    events: Array<Record<string, unknown>>;
    total: number;
  }>;
}

export async function getObservabilityInfrastructure() {
  const res = await fetch(observabilityUrl("/infrastructure"), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load infrastructure");
  return res.json() as Promise<{
    snapshot: Record<string, unknown>;
    catalogue: Array<{ key: string; title: string; severity: string; description: string }>;
  }>;
}

export async function getObservabilityErrors(from?: string, to?: string) {
  const res = await fetch(observabilityUrl("/errors", { from, to }), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load errors");
  return res.json() as Promise<{ events: Array<Record<string, unknown>>; total: number }>;
}

export async function getObservabilityAlerts(status = "open") {
  const res = await fetch(observabilityUrl("/alerts", { status }), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load alerts");
  return res.json() as Promise<{
    alerts: Array<Record<string, unknown>>;
    total: number;
    catalogue: Array<{ key: string; title: string; severity: string; description: string }>;
  }>;
}

export async function getObservabilityKpis(from?: string, to?: string) {
  const res = await fetch(observabilityUrl("/kpis", { from, to }), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load KPIs");
  return res.json() as Promise<{
    kpis: {
      trialToPaidRate: number | null;
      paidToActivationRate: number | null;
      activationToFirstSearchRate: number | null;
      firstToSecondSearchRate: number | null;
      secondSearchToOutreachRate: number | null;
      checkoutAbandonRate: number | null;
      paymentSuccessRate: number | null;
      mailboxAdoptionRate: number | null;
      counts: Record<string, number>;
    };
  }>;
}

export function getObservabilityEventsCsvUrl(from?: string, to?: string): string {
  return observabilityUrl("/events.csv", { from, to });
}

export async function getObservabilityExecutive() {
  const res = await fetch(observabilityUrl("/executive"), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load executive overview");
  return res.json() as Promise<{
    executive: {
      todaysRevenueEvents: number;
      todaysSearches: number;
      trialUsers: number;
      payingUsers: number;
      activatedUsers: number;
      conversionRate: number | null;
      openAlerts: number;
      errors: number;
      smtpHealth: { sent: number; failed: number };
    };
  }>;
}

export async function getObservabilityCohorts() {
  const res = await fetch(observabilityUrl("/cohorts"), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load cohorts");
  return res.json() as Promise<{
    cohorts: Record<string, Record<string, number>>;
    retentionProxy: Record<string, number | null>;
  }>;
}

export async function getObservabilityTimeline(params: {
  email?: string;
  emailHash?: string;
  licenseId?: string;
  sessionId?: string;
}) {
  const res = await fetch(
    observabilityUrl("/timeline", {
      email: params.email,
      emailHash: params.emailHash,
      licenseId: params.licenseId,
      sessionId: params.sessionId,
    }),
    { headers: getAdminHeaders(), cache: "no-store" }
  );
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load timeline");
  return res.json() as Promise<{ events: Array<Record<string, unknown>>; total: number }>;
}

export async function getObservabilityAttribution(from?: string, to?: string) {
  const res = await fetch(observabilityUrl("/attribution", { from, to }), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load attribution");
  return res.json() as Promise<{
    attributed: Array<{ source: string; medium: string; campaign: string; purchases: number }>;
    purchases: number;
  }>;
}

export async function getObservabilitySearchQuality(from?: string, to?: string) {
  const res = await fetch(observabilityUrl("/search-quality", { from, to }), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load search quality");
  return res.json() as Promise<{
    summary: Record<string, number | null>;
    failedReplayMetadata: Array<Record<string, unknown>>;
  }>;
}

export async function getObservabilityLicenseHealth(from?: string, to?: string) {
  const res = await fetch(observabilityUrl("/license-health", { from, to }), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load license health");
  return res.json() as Promise<{ counts: Record<string, number> }>;
}

export async function getObservabilityOutreachHealth(from?: string, to?: string) {
  const res = await fetch(observabilityUrl("/outreach-health", { from, to }), {
    headers: getAdminHeaders(),
    cache: "no-store",
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load outreach health");
  return res.json() as Promise<{
    counts: Record<string, number>;
    rates: { failureRate: number | null; openRate: number | null };
  }>;
}

export async function getObservabilityEmailRevenue(params?: {
  from?: string;
  to?: string;
  sequenceVersion?: number;
  sequenceStep?: number;
}) {
  const res = await fetch(
    observabilityUrl("/email-revenue", {
      from: params?.from,
      to: params?.to,
      sequenceVersion: params?.sequenceVersion,
      sequenceStep: params?.sequenceStep,
    }),
    { headers: getAdminHeaders(), cache: "no-store" }
  );
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load email revenue");
  return res.json() as Promise<{
    from: string;
    to: string;
    attributionModel: string;
    attributionWindowDays: number;
    metricsAvailableFrom: string;
    rows: Array<{
      email: string;
      sequenceVersion: number;
      sequenceStep: number;
      sends: number;
      uniqueOpens: number;
      totalOpens: number;
      clicks: number;
      uniqueClickers: number;
      searches: number;
      checkouts: number;
      purchases: number;
      activations: number;
      outreach: number;
      revenueUsd: number;
      openRate: number | null;
      clickRate: number | null;
      clickToSearchRate: number | null;
      clickToCheckoutRate: number | null;
      clickToPurchaseRate: number | null;
      revenuePerEmail: number | null;
      revenuePerRecipient: number | null;
    }>;
    totals: {
      sends: number;
      uniqueOpens: number;
      clicks: number;
      searches: number;
      checkouts: number;
      purchases: number;
      revenueUsd: number;
      openRate: number | null;
      clickRate: number | null;
    };
  }>;
}

export async function patchObservabilityAlert(
  id: string,
  status: "acknowledged" | "resolved" | "open"
) {
  const res = await fetch(observabilityUrl(`/alerts/${id}`), {
    method: "PATCH",
    headers: { ...getAdminHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to update alert");
  return res.json() as Promise<{ success: boolean }>;
}

export async function getObservabilityFunnelsFiltered(params?: {
  from?: string;
  to?: string;
  country?: string;
  device?: string;
  browser?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
}) {
  const res = await fetch(
    observabilityUrl("/funnels", {
      from: params?.from,
      to: params?.to,
      country: params?.country,
      device: params?.device,
      browser: params?.browser,
      utmSource: params?.utmSource,
      utmMedium: params?.utmMedium,
      utmCampaign: params?.utmCampaign,
      referrer: params?.referrer,
    }),
    { headers: getAdminHeaders(), cache: "no-store" }
  );
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to load funnels");
  return res.json() as Promise<{
    from: string;
    to: string;
    steps: Array<{
      step: string;
      count: number;
      conversionFromPrev: number;
      dropOffFromPrev?: number;
      avgDurationMs?: number | null;
      medianDurationMs?: number | null;
    }>;
  }>;
}


