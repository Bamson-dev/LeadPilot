import { getDeviceId } from "@/lib/device";
import { getApiUrl } from "@/utils/env";

export async function registerDeviceForLicense(email: string, key: string): Promise<void> {
  const deviceSignature = getDeviceId();
  if (!deviceSignature) {
    throw new Error("Could not identify this device. Try a different browser.");
  }

  const res = await fetch(`${getApiUrl()}/auth/register-device`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.toLowerCase().trim(),
      key: key.trim().toUpperCase(),
      deviceSignature,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new Error(
      data.error ??
        "Device registration failed. Contact support on WhatsApp 09067285890."
    );
  }
}

export async function activateLicense(email: string, key: string) {
  const deviceSignature = getDeviceId();
  if (!deviceSignature) {
    throw new Error("Could not identify this device. Try a different browser.");
  }

  const res = await fetch(`${getApiUrl()}/auth/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      key: key.trim().toUpperCase(),
      deviceSignature,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    success?: boolean;
    code?: string;
  };

  if (!res.ok) {
    throw new Error(
      data.error ??
        (data.code === "MAX_DEVICES"
          ? "Maximum devices reached. Contact support on WhatsApp 09067285890 to reset your devices."
          : "Activation failed")
    );
  }

  return data;
}
