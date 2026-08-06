"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { activateLicense } from "@/services/auth-api";
import { setStoredLicense, hasStoredLicense } from "@/lib/license";
import { PublicFunnelShell } from "@/components/public/public-funnel-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelContent } from "@/components/ui/panel";

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
      const msg = searchParams.get("message");
      setError(
        msg
          ? decodeURIComponent(msg)
          : "Maximum devices reached. Contact support on WhatsApp 09067285890 to reset your devices."
      );
    }
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const normalizedEmail = email.trim();
      const normalizedKey = key.trim();
      await activateLicense(normalizedEmail, normalizedKey);
      setStoredLicense(normalizedEmail, normalizedKey);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicFunnelShell
      ctaHref="/freetrial"
      ctaLabel="Try Free"
      showFooter={false}
      mainClassName="flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center py-10 md:py-12"
    >
      <Panel className="w-full">
        <PanelContent className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h1 className="m-0 text-2xl font-bold text-[var(--lt-text)]">Log in to LeadThur</h1>
              <p className="mt-2 text-sm text-[var(--lt-text-muted)]">
                Enter the email and license key from your purchase or activation email to open your
                dashboard.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--lt-text-muted)]">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--lt-text-muted)]">License key</label>
              <Input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="LP-XXXXXXXX-XXXXXXXX"
                className="min-h-11 font-mono text-sm"
                required
              />
            </div>

            {error ? (
              <Alert variant="danger" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" size="lg" className="h-11 w-full font-semibold" disabled={loading}>
              {loading ? "Signing in…" : "Log in"}
            </Button>
          </form>
        </PanelContent>
      </Panel>
    </PublicFunnelShell>
  );
}
