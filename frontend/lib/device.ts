const DEVICE_ID_KEY = "leadthur_device_id";

/** Stable per-browser device id — survives user-agent / screen size changes. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing?.trim()) {
    return existing.trim();
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}
