import { getApiUrl } from "@/utils/env";

const TOKEN_KEY = "leadpilot_admin_token";

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

export async function updateSearchLimit(email: string, newLimit: number) {
  const res = await fetch(`${getApiUrl()}/admin/update-limit`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ email, newLimit }),
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to update limit");
  return res.json();
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

export async function resetDevices(email: string) {
  const res = await fetch(`${getApiUrl()}/admin/reset-devices`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ email }),
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to reset devices");
  return res.json() as Promise<{ success: boolean; message?: string }>;
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

export async function sendMessage(email: string, subject: string, message: string) {
  const res = await fetch(`${getApiUrl()}/admin/send-message`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ email, subject, message }),
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to send message");
  return res.json() as Promise<{ success: boolean; message?: string }>;
}

export async function sendBroadcast(subject: string, message: string) {
  const res = await fetch(`${getApiUrl()}/admin/broadcast`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ subject, message }),
  });
  await handleAdminResponse(res);
  if (!res.ok) throw new Error("Failed to send broadcast");
  return res.json() as Promise<{ success: boolean; message?: string; count?: number }>;
}
