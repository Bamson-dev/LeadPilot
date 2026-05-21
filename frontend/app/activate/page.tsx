"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { activateLicense } from "@/services/auth-api";
import { setStoredLicense, hasStoredLicense } from "@/lib/license";

export default function ActivatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasStoredLicense()) {
      router.replace("/dashboard");
      return;
    }

    const keyFromUrl = searchParams.get("key");
    if (keyFromUrl) {
      setKey(keyFromUrl.trim().toUpperCase());
    }

    if (searchParams.get("error") === "max_devices") {
      setError("Maximum devices reached. Contact support to register a new device.");
    }
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await activateLicense(email.trim(), key.trim());
      setStoredLicense(email.trim(), key.trim());
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-4">
      <form onSubmit={handleSubmit} className="glass w-full max-w-md rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-[#F4F4FF]">Activate LeadPilot</h1>
        <p className="mt-2 text-sm text-[#6B6B80]">
          Enter the email and license key from your activation email.
        </p>

        <label className="mt-6 block text-xs font-medium text-[#6B6B80]">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[#F4F4FF] outline-none focus:border-[#7C3AED]"
          required
        />

        <label className="mt-4 block text-xs font-medium text-[#6B6B80]">License key</label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          placeholder="LP-XXXXXXXX-XXXXXXXX"
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-[#F4F4FF] outline-none focus:border-[#7C3AED]"
          required
        />

        {error && (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-[#7C3AED] py-2.5 font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-60"
        >
          {loading ? "Activating…" : "Activate account"}
        </button>
      </form>
    </main>
  );
}
