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

export async function getAdminStats(): Promise<AdminStats> {
  const res = await fetch(`${getApiUrl()}/admin/stats`, {
    headers: getAdminHeaders(),
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}
