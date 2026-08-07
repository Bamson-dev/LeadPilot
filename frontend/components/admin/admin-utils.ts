import { getAdminToken } from "@/services/admin-api";

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function getAdminFetchHeaders(): HeadersInit {
  const token = getAdminToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function getAdminJsonHeaders(): HeadersInit {
  return {
    ...getAdminFetchHeaders(),
    "Content-Type": "application/json",
  };
}

export function isAdminDemoMode(): boolean {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  }
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    window.location.hostname === "staging.leadthur.com"
  );
}
