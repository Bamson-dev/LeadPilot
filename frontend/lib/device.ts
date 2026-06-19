const DEVICE_ID_KEY = "leadthur_device_id";
const SESSION_DEVICE_ID_KEY = "leadthur_device_id";

let memoryDeviceId = "";

function readCookieDeviceId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)leadthur_did=([^;]+)/);
  return match ? decodeURIComponent(match[1]).trim() : "";
}

function persistCookieDeviceId(id: string): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 400;
  const secure = window.location.protocol === "https:" ? ";Secure" : "";
  document.cookie = `leadthur_did=${encodeURIComponent(id)};path=/;max-age=${maxAge};SameSite=Lax${secure}`;
}

function readStoredDeviceId(): string {
  if (typeof window === "undefined") return "";

  try {
    const fromLocal = localStorage.getItem(DEVICE_ID_KEY);
    if (fromLocal?.trim()) return fromLocal.trim();
  } catch {
    /* localStorage may be blocked */
  }

  const fromCookie = readCookieDeviceId();
  if (fromCookie) return fromCookie;

  try {
    const fromSession = sessionStorage.getItem(SESSION_DEVICE_ID_KEY);
    if (fromSession?.trim()) return fromSession.trim();
  } catch {
    /* sessionStorage may be blocked */
  }

  return memoryDeviceId.trim();
}

function persistDeviceId(id: string): void {
  memoryDeviceId = id;

  try {
    localStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    /* ignore */
  }

  persistCookieDeviceId(id);

  try {
    sessionStorage.setItem(SESSION_DEVICE_ID_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Stable per-browser device id — survives user-agent / screen size changes. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  const existing = readStoredDeviceId();
  if (existing) {
    persistDeviceId(existing);
    return existing;
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  persistDeviceId(id);
  return id;
}
