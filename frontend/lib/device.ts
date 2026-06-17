const DEVICE_ID_KEY = "leadthur_device_id";
const SESSION_DEVICE_ID_KEY = "leadthur_device_id";

let memoryDeviceId = "";

function readStoredDeviceId(): string {
  if (typeof window === "undefined") return "";

  try {
    const fromLocal = localStorage.getItem(DEVICE_ID_KEY);
    if (fromLocal?.trim()) return fromLocal.trim();
  } catch {
    /* localStorage may be blocked */
  }

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
    return existing;
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  persistDeviceId(id);
  return id;
}
