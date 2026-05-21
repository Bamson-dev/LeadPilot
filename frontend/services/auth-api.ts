import { getApiUrl } from "@/utils/env";

export async function activateLicense(email: string, key: string) {
  const res = await fetch(`${getApiUrl()}/auth/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, key: key.trim().toUpperCase() }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    success?: boolean;
  };

  if (!res.ok) {
    throw new Error(data.error ?? "Activation failed");
  }

  return data;
}
