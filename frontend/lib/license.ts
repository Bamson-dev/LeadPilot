const EMAIL_KEY = "leadpilot_email";
const LICENSE_KEY = "leadpilot_key";

export function getStoredLicense(): { email: string; key: string } | null {
  if (typeof window === "undefined") return null;
  const email = localStorage.getItem(EMAIL_KEY);
  const key = localStorage.getItem(LICENSE_KEY);
  if (!email || !key) return null;
  return { email, key };
}

export function setStoredLicense(email: string, key: string): void {
  localStorage.setItem(EMAIL_KEY, email.toLowerCase().trim());
  localStorage.setItem(LICENSE_KEY, key.trim().toUpperCase());
}

export function clearStoredLicense(): void {
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(LICENSE_KEY);
}

export function hasStoredLicense(): boolean {
  return getStoredLicense() !== null;
}
