"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  KeyRound,
  LogOut,
  Monitor,
  Palette,
  RefreshCw,
  Settings2,
  Shield,
  Users,
} from "lucide-react";
import { DiscoveryWorkspaceHeader } from "@/components/discovery/discovery-workspace-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDeviceId } from "@/lib/device";
import { clearStoredLicense, getStoredLicense } from "@/lib/license";
import {
  mailboxHealth,
  mailboxHealthBadge,
  mailboxHealthLabel,
  mailboxStatusBadge,
  mailboxStatusLabel,
} from "@/lib/mailbox-display";
import { getLicenseUsage, getLicenseHeaders, type LicenseUsage } from "@/services/api";
import { fetchMailboxes, fetchOutreachBalance } from "@/services/outreach-api";
import type { OutreachBalance, OutreachMailbox } from "@/types/outreach";
import { getApiUrl } from "@/utils/env";
import { cn } from "@/utils/utils";

type LoadState = "loading" | "ready" | "error";

interface AuthStatusView {
  valid: boolean;
  reason?: string;
  code?: string;
  licenseId?: string;
}

function maskLicenseKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

function authBadge(status: AuthStatusView | null): {
  status: "active" | "error" | "processing" | "paused";
  label: string;
} {
  if (!status) return { status: "paused", label: "Unknown" };
  if (status.valid) return { status: "active", label: "Active" };
  if (status.code === "SUSPENDED") return { status: "error", label: "Suspended" };
  if (status.code === "NOT_ACTIVATED") return { status: "processing", label: "Not activated" };
  return { status: "error", label: status.code || "Invalid" };
}

function SettingsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading settings">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export function SettingsPageWorkspace() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatusView | null>(null);
  const [usage, setUsage] = useState<LicenseUsage | null>(null);
  const [balance, setBalance] = useState<OutreachBalance | null>(null);
  const [mailboxes, setMailboxes] = useState<OutreachMailbox[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [fullKey, setFullKey] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    const stored = getStoredLicense();
    if (!stored) {
      router.replace("/activate");
      return;
    }
    setEmail(stored.email);
    setFullKey(stored.key);
    setMaskedKey(maskLicenseKey(stored.key));
    setDeviceId(getDeviceId() || "—");

    try {
      const apiUrl = getApiUrl();
      const [statusRes, usageRes, balanceRes, mailboxesRes] = await Promise.all([
        apiUrl
          ? fetch(`${apiUrl}/auth/status`, {
              headers: getLicenseHeaders(),
              cache: "no-store",
            })
              .then(async (res) => {
                const data = (await res.json().catch(() => ({}))) as AuthStatusView;
                return data;
              })
              .catch(() => null)
          : Promise.resolve(null),
        getLicenseUsage(),
        fetchOutreachBalance(),
        fetchMailboxes().catch(() => [] as OutreachMailbox[]),
      ]);

      setAuthStatus(statusRes);
      setUsage(usageRes);
      setBalance(balanceRes);
      setMailboxes(mailboxesRes);
      setState("ready");
    } catch {
      setError("Could not load account settings. Try again.");
      setState("error");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleSignOut() {
    clearStoredLicense();
    localStorage.removeItem("lp_suspended_reason");
    router.replace("/activate");
  }

  const badge = authBadge(authStatus);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      <DiscoveryWorkspaceHeader
        title="Settings"
        subtitle="Account, license, and connected Gmail mailboxes. Preferences without a backend stay unavailable."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={state === "loading"}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", state === "loading" && "animate-spin")}
          />
          Refresh
        </Button>
        <Button type="button" variant="soft" size="sm" asChild>
          <Link href="/dashboard/plans">Billing & plans</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>

      {error ? (
        <Alert variant="danger">
          <AlertTitle>Settings unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {state === "loading" ? <SettingsSkeleton /> : null}

      {state === "ready" || state === "error" ? (
        <>
          <Panel>
            <PanelHeader>
              <PanelTitle>Profile & account</PanelTitle>
              <StatusBadge status={badge.status} label={badge.label} />
            </PanelHeader>
            <PanelContent className="space-y-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--lt-text-muted)]">Email</dt>
                  <dd className="mt-0.5 break-all font-medium text-[var(--lt-text)]">
                    {email || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--lt-text-muted)]">License key</dt>
                  <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[var(--lt-text)]">
                    <span>{keyVisible ? fullKey : maskedKey}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setKeyVisible((v) => !v)}
                    >
                      {keyVisible ? "Hide" : "Show"}
                    </Button>
                  </dd>
                </div>
                {authStatus?.licenseId ? (
                  <div>
                    <dt className="text-[var(--lt-text-muted)]">License ID</dt>
                    <dd className="mt-0.5 font-mono text-xs text-[var(--lt-text-subtle)]">
                      {authStatus.licenseId}
                    </dd>
                  </div>
                ) : null}
                {authStatus && !authStatus.valid ? (
                  <div className="sm:col-span-2">
                    <dt className="text-[var(--lt-text-muted)]">Status detail</dt>
                    <dd className="mt-0.5 text-[var(--lt-danger)]">
                      {authStatus.reason || authStatus.code || "License not valid"}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="text-xs text-[var(--lt-text-subtle)]">
                LeadThur accounts use a license key (not a password). Sign out clears the
                key from this browser only.
              </p>
            </PanelContent>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>License & usage</PanelTitle>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/plans">Manage billing</Link>
                </Button>
              </PanelHeader>
              <PanelContent>
                {!usage && !balance ? (
                  <EmptyState
                    icon={<KeyRound className="h-5 w-5" />}
                    title="Usage unavailable"
                    description="Could not load search or outreach balances."
                  />
                ) : (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Search credits</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {(usage?.search_credits ?? 0).toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Free searches left</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {(usage?.freeSearchesRemaining ?? 0).toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Outreach sends</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {(balance?.send_balance ?? 0).toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Outreach plan</dt>
                      <dd className="mt-0.5 font-semibold">
                        {balance?.subscription_tier || "None"}{" "}
                        <span className="text-xs font-normal text-[var(--lt-text-subtle)]">
                          ({balance?.subscription_status || "n/a"})
                        </span>
                      </dd>
                    </div>
                  </dl>
                )}
              </PanelContent>
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>This device</PanelTitle>
              </PanelHeader>
              <PanelContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Monitor className="mt-0.5 h-4 w-4 text-[var(--lt-text-muted)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--lt-text)]">
                      Browser device ID
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-[var(--lt-text-subtle)]">
                      {deviceId}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[var(--lt-text-subtle)]">
                  Device registration runs automatically on activate and dashboard load.
                  Listing or revoking other devices is not available in the user API —
                  contact support on WhatsApp if you hit the device limit.
                </p>
              </PanelContent>
            </Panel>
          </div>

          <Panel>
            <PanelHeader>
              <PanelTitle>Connected services</PanelTitle>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/dashboard/mailboxes">Manage mailboxes</Link>
              </Button>
            </PanelHeader>
            <PanelContent>
              {mailboxes.length === 0 ? (
                <EmptyState
                  icon={<Settings2 className="h-5 w-5" />}
                  title="No mailboxes connected"
                  description="Gmail SMTP mailboxes are the only connected service. Connect one to send outreach."
                  action={
                    <Button type="button" size="sm" asChild>
                      <Link href="/dashboard/mailboxes?connect=1">Connect mailbox</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-[var(--lt-border)]">
                  {mailboxes.map((mailbox) => {
                    const health = mailboxHealth(mailbox);
                    return (
                      <li
                        key={mailbox.id}
                        className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--lt-text)]">
                            {mailbox.email_address}
                          </p>
                          <p className="text-xs text-[var(--lt-text-subtle)]">
                            Gmail · {mailbox.account_type}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge status={mailboxStatusBadge(mailbox.status)}>
                            {mailboxStatusLabel(mailbox.status)}
                          </StatusBadge>
                          <StatusBadge status={mailboxHealthBadge(health)}>
                            {mailboxHealthLabel(health)}
                          </StatusBadge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelContent>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>Password & security</PanelTitle>
              </PanelHeader>
              <PanelContent>
                <EmptyState
                  className="py-8"
                  icon={<Shield className="h-5 w-5" />}
                  title="Password login not used"
                  description="Access is license-key based. There is no password change, 2FA, or security dashboard API for users."
                />
              </PanelContent>
            </Panel>
            <Panel>
              <PanelHeader>
                <PanelTitle>Notifications</PanelTitle>
              </PanelHeader>
              <PanelContent>
                <EmptyState
                  className="py-8"
                  icon={<Bell className="h-5 w-5" />}
                  title="Preferences unavailable"
                  description="In-app notification preferences are not persisted. The shell bell remains disabled by design."
                />
              </PanelContent>
            </Panel>
            <Panel>
              <PanelHeader>
                <PanelTitle>Appearance</PanelTitle>
              </PanelHeader>
              <PanelContent>
                <EmptyState
                  className="py-8"
                  icon={<Palette className="h-5 w-5" />}
                  title="Theme toggle unavailable"
                  description="RC1 uses the LeadThur design tokens only. There is no user theme preference API."
                />
              </PanelContent>
            </Panel>
            <Panel>
              <PanelHeader>
                <PanelTitle>Team & API</PanelTitle>
              </PanelHeader>
              <PanelContent>
                <EmptyState
                  className="py-8"
                  icon={<Users className="h-5 w-5" />}
                  title="Not supported"
                  description="No team seats, roles, API key generation, workspace switching, or audit logs in the user backend."
                />
              </PanelContent>
            </Panel>
          </div>

          <Panel>
            <PanelHeader>
              <PanelTitle>Support</PanelTitle>
            </PanelHeader>
            <PanelContent className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <a
                  href="https://wa.me/2349067285890"
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp support
                </a>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href="mailto:access@leadthur.com">access@leadthur.com</a>
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/dashboard/affiliate">Affiliate programme</Link>
              </Button>
            </PanelContent>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
