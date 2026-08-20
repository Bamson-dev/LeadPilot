"use client";

import { Loader2 } from "lucide-react";
import {
  AdminConfirmDialog,
  AdminPanel,
  adminErrorClass,
  adminLabelClass,
  adminMutedClass,
  adminSectionBodyClass,
} from "@/components/admin/admin-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelContent } from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/status-badge";
import {
  lookupLicense,
  resendAccess,
  resetDevices,
  upgradeDevices,
  resetSearches,
  suspendAccount,
  unsuspendAccount,
  updateSearchLimit,
  type AdminLicense,
} from "@/services/admin-api";
import { cn } from "@/utils/utils";
import { useCallback, useEffect, useState } from "react";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function truncateKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 12)}...`;
}

function licenseStatus(license: AdminLicense): { status: StatusBadgeStatus; label: string } {
  if (license.is_suspended) return { status: "error", label: "Suspended" };
  if (license.activated) return { status: "active", label: "Activated" };
  return { status: "paused", label: "Pending" };
}

interface AccountLookupProps {
  onSessionExpired: () => void;
  prefillEmail?: string | null;
  onPrefillConsumed?: () => void;
}

export function AccountLookup({
  onSessionExpired,
  prefillEmail,
  onPrefillConsumed,
}: AccountLookupProps) {
  const [searchEmail, setSearchEmail] = useState("");
  const [license, setLicense] = useState<AdminLicense | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);

  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [searchLimitInput, setSearchLimitInput] = useState("100");
  const [searchLimitLoading, setSearchLimitLoading] = useState(false);
  const [searchLimitResult, setSearchLimitResult] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState("");
  const [newDeviceLimit, setNewDeviceLimit] = useState("4");

  const clearActionMsg = useCallback(() => {
    const t = setTimeout(() => setActionMsg(null), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (actionMsg) return clearActionMsg();
  }, [actionMsg, clearActionMsg]);

  const handleError = (err: unknown) => {
    if (err instanceof Error && err.message === "SESSION_EXPIRED") {
      onSessionExpired();
      return true;
    }
    setActionMsg({
      type: "err",
      text: err instanceof Error ? err.message : "Action failed",
    });
    return false;
  };

  const refreshLookup = async (email: string) => {
    const result = await lookupLicense(email);
    if (!result || result.licenses.length === 0) {
      setLicense(null);
      setNotFound(true);
      return;
    }
    setLicense(result.licenses[0]);
    setNotFound(false);
    setNewDeviceLimit(String(result.licenses[0].max_devices ?? 4));
    setSearchLimitInput(String(result.licenses[0].monthly_search_limit ?? 100));
  };

  useEffect(() => {
    const email = prefillEmail?.trim();
    if (!email) return;

    setSearchEmail(email);
    setSearching(true);
    setNotFound(false);
    setActionMsg(null);

    void refreshLookup(email)
      .catch((err) => {
        if (!handleError(err)) {
          setLicense(null);
          setNotFound(true);
        }
      })
      .finally(() => {
        setSearching(false);
        onPrefillConsumed?.();
      });
  }, [prefillEmail]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = searchEmail.trim();
    if (!email) {
      setLicense(null);
      setNotFound(false);
      return;
    }

    setSearching(true);
    setNotFound(false);
    setActionMsg(null);
    setShowSuspendForm(false);
    setConfirmReset(false);
    setResetResult("");
    setUpgradeResult("");
    setSearchLimitResult("");

    try {
      await refreshLookup(email);
    } catch (err) {
      if (!handleError(err)) {
        setLicense(null);
        setNotFound(true);
      }
    } finally {
      setSearching(false);
    }
  };

  const runAction = async (fn: () => Promise<{ message?: string }>) => {
    if (!license) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      const result = await fn();
      setActionMsg({ type: "ok", text: result.message ?? "Done" });
      await refreshLookup(license.email);
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const searchCount = license?.search_count ?? license?.searches_used ?? 0;
  const monthlyLimit = license?.monthly_search_limit ?? 100;
  const maxDevices = license?.max_devices ?? 4;

  async function handleUpdateSearchLimit() {
    if (!license?.email) return;
    const parsed = parseInt(searchLimitInput, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setSearchLimitResult("Enter a valid search limit (0 or higher).");
      return;
    }

    setSearchLimitLoading(true);
    setSearchLimitResult("");
    const result = await updateSearchLimit(license.email, parsed);
    if (result.error === "SESSION_EXPIRED") {
      onSessionExpired();
      setSearchLimitLoading(false);
      return;
    }
    setSearchLimitResult(result.message || result.error || "Done");
    setSearchLimitLoading(false);
    if (result.success) {
      await refreshLookup(license.email);
    }
  }

  async function handleResetDevices() {
    if (!license?.email) return;
    setResetLoading(true);
    setResetResult("");
    const result = await resetDevices(license.email);
    if (result.error === "SESSION_EXPIRED") {
      onSessionExpired();
      setResetLoading(false);
      return;
    }
    setResetResult(result.message || result.error || "Done");
    setResetLoading(false);
    if (result.success) {
      await refreshLookup(license.email);
    }
  }

  async function handleUpgradeDevices() {
    if (!license?.email) return;
    setUpgradeLoading(true);
    setUpgradeResult("");
    const result = await upgradeDevices(license.email, parseInt(newDeviceLimit, 10));
    if (result.error === "SESSION_EXPIRED") {
      onSessionExpired();
      setUpgradeLoading(false);
      return;
    }
    setUpgradeResult(result.message || result.error || "Done");
    setUpgradeLoading(false);
    if (result.success) {
      await refreshLookup(license.email);
    }
  }

  const resultTone = (text: string) =>
    text.toLowerCase().includes("updated") ||
    text.toLowerCase().includes("success") ||
    text.toLowerCase().includes("reset")
      ? "text-[var(--lt-success)]"
      : "text-[var(--lt-danger)]";

  return (
    <AdminPanel
      title="Account Lookup"
      description="Search any buyer by email and manage their account from here."
      className="mt-0"
    >
      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 space-y-1">
          <label className={adminLabelClass} htmlFor="account-lookup-email">
            Search by email address
          </label>
          <Input
            id="account-lookup-email"
            type="text"
            value={searchEmail}
            onChange={(e) => {
              setSearchEmail(e.target.value);
              if (!e.target.value.trim()) {
                setLicense(null);
                setNotFound(false);
              }
            }}
            placeholder="buyer@email.com"
          />
        </div>
        <Button type="submit" disabled={searching} className="sm:self-end">
          {searching ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {notFound && <p className={cn("mt-4", adminMutedClass)}>No account found for that email address.</p>}

      {license && (
        <div className="mt-6 rounded-xl border border-[var(--lt-border)] bg-[var(--lt-bg)] p-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className={adminLabelClass}>Email</dt>
              <dd className="font-medium text-[var(--lt-text)]">{license.email}</dd>
            </div>
            <div>
              <dt className={adminLabelClass}>License Key</dt>
              <dd className="font-mono text-[var(--lt-accent-soft)]">{truncateKey(license.key)}</dd>
            </div>
            <div>
              <dt className={adminLabelClass}>Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={licenseStatus(license).status} label={licenseStatus(license).label} />
              </dd>
            </div>
            <div>
              <dt className={adminLabelClass}>Payment Channel</dt>
              <dd className="mt-0.5">
                <StatusBadge
                  status="active"
                  label={license.payment_channel === "paystack" ? "Paystack" : "Bank Transfer"}
                />
              </dd>
            </div>
            <div>
              <dt className={adminLabelClass}>Searches Used</dt>
              <dd className="text-[var(--lt-text)]">
                {searchCount} of {monthlyLimit}
              </dd>
            </div>
            <div>
              <dt className={adminLabelClass}>Max Devices Allowed</dt>
              <dd className="font-semibold text-[var(--lt-text)]">{maxDevices}</dd>
            </div>
            <div>
              <dt className={adminLabelClass}>Activated Date</dt>
              <dd className="text-[var(--lt-text)]">{formatDate(license.activated_at)}</dd>
            </div>
            <div>
              <dt className={adminLabelClass}>Created Date</dt>
              <dd className="text-[var(--lt-text)]">{formatDate(license.created_at)}</dd>
            </div>
            {license.is_suspended && license.suspension_reason && (
              <div className="sm:col-span-2">
                <dt className={adminLabelClass}>Suspension Reason</dt>
                <dd className="text-[var(--lt-danger)]">{license.suspension_reason}</dd>
              </div>
            )}
          </dl>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={actionLoading}
              onClick={() =>
                runAction(() => resendAccess(license.email) as Promise<{ message?: string }>)
              }
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend Email"}
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={actionLoading}
              onClick={() => setConfirmReset(true)}
            >
              Reset Searches
            </Button>

            {!license.is_suspended ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={actionLoading}
                onClick={() => setShowSuspendForm((v) => !v)}
              >
                {showSuspendForm ? "Cancel Suspend" : "Suspend"}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={actionLoading}
                onClick={() =>
                  runAction(
                    () => unsuspendAccount(license.email) as Promise<{ message?: string }>
                  )
                }
              >
                Unsuspend
              </Button>
            )}
          </div>

          {showSuspendForm && !license.is_suspended ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--lt-danger)]/30 bg-[var(--lt-danger)]/5 p-3">
              <p className="w-full text-xs text-[var(--lt-text-muted)]">
                Enter an optional reason, then confirm to suspend this account.
              </p>
              <Input
                type="text"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Reason (optional)"
                className="min-w-[200px] flex-1"
                autoFocus
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={actionLoading}
                onClick={() =>
                  void runAction(
                    () =>
                      suspendAccount(license.email, suspendReason) as Promise<{
                        message?: string;
                      }>
                  ).then(() => {
                    setShowSuspendForm(false);
                    setSuspendReason("");
                  })
                }
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Suspend"}
              </Button>
            </div>
          ) : null}

          <Panel className="mt-3">
            <PanelContent className={cn(adminSectionBodyClass, "space-y-3")}>
              <p className={cn(adminLabelClass, "uppercase tracking-wide")}>Search Limit Management</p>
              <p className="text-xs text-[var(--lt-text-subtle)]">
                Current usage:{" "}
                <strong className="text-[var(--lt-text)]">
                  {searchCount} of {monthlyLimit}
                </strong>
                {" · "}
                Free monthly limit:{" "}
                <strong className="text-[var(--lt-text)]">{monthlyLimit} searches</strong>
                {(license.search_credits ?? 0) > 0 && (
                  <>
                    {" · "}
                    Top-up credits:{" "}
                    <strong className="text-[var(--lt-accent-soft)]">{license.search_credits}</strong>
                  </>
                )}
              </p>
              <p className={adminLabelClass}>Change monthly free search limit</p>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={
                    [50, 100, 200, 500, 1000, 2000, 5000].includes(parseInt(searchLimitInput, 10))
                      ? searchLimitInput
                      : "custom"
                  }
                  onValueChange={(value) => {
                    if (value !== "custom") setSearchLimitInput(value);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select limit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 searches</SelectItem>
                    <SelectItem value="100">100 searches (default)</SelectItem>
                    <SelectItem value="200">200 searches</SelectItem>
                    <SelectItem value="500">500 searches</SelectItem>
                    <SelectItem value="1000">1,000 searches</SelectItem>
                    <SelectItem value="2000">2,000 searches</SelectItem>
                    <SelectItem value="5000">5,000 searches</SelectItem>
                    <SelectItem value="custom">Custom amount</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  max={100000}
                  value={searchLimitInput}
                  onChange={(e) => setSearchLimitInput(e.target.value)}
                  className="w-24"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleUpdateSearchLimit()}
                  disabled={searchLimitLoading}
                >
                  {searchLimitLoading ? "Saving..." : "Update Search Limit"}
                </Button>
              </div>
              {searchLimitResult ? (
                <p className={cn("text-xs font-semibold", resultTone(searchLimitResult))}>
                  {searchLimitResult}
                </p>
              ) : null}
            </PanelContent>
          </Panel>

          <Panel className="mt-3">
            <PanelContent className={cn(adminSectionBodyClass, "space-y-3")}>
              <p className={cn(adminLabelClass, "uppercase tracking-wide")}>Device Management</p>
              <p className="text-xs text-[var(--lt-text-subtle)]">
                Current limit: <strong className="text-[var(--lt-text)]">{maxDevices} devices</strong>
                {" · "}
                Slots used:{" "}
                <strong className="text-[var(--lt-text)]">
                  {
                    [
                      license.device_one,
                      license.device_two,
                      license.device_three,
                      license.device_four,
                    ].filter((v) => v !== null && v !== undefined && String(v).trim() !== "").length
                  }
                </strong>
              </p>
              <div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleResetDevices()}
                  disabled={resetLoading}
                >
                  {resetLoading ? "Resetting..." : "Reset All Devices"}
                </Button>
                <p className="mt-1 text-[10px] text-[var(--lt-text-subtle)]">
                  Clears all registered devices. User can log in fresh from up to {maxDevices} new
                  devices.
                </p>
                {resetResult ? (
                  <p className={cn("mt-2 text-xs font-semibold", resultTone(resetResult))}>
                    {resetResult}
                  </p>
                ) : null}
              </div>
              <div>
                <p className={adminLabelClass}>Change device limit</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Select value={newDeviceLimit} onValueChange={setNewDeviceLimit}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 4 ? "(default)" : ""} device{n !== 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleUpgradeDevices()}
                    disabled={upgradeLoading}
                  >
                    {upgradeLoading ? "Updating..." : "Update Device Limit"}
                  </Button>
                </div>
                {upgradeResult ? (
                  <p className={cn("mt-2 text-xs font-semibold", resultTone(upgradeResult))}>
                    {upgradeResult}
                  </p>
                ) : null}
              </div>
            </PanelContent>
          </Panel>

          <AdminConfirmDialog
            open={confirmReset}
            title="Reset searches"
            description="Reset search count to 0 for this user?"
            confirmLabel="Confirm"
            onCancel={() => setConfirmReset(false)}
            onConfirm={() =>
              void runAction(
                () => resetSearches(license.email) as Promise<{ message?: string }>
              ).then(() => setConfirmReset(false))
            }
          />

          {actionMsg && (
            <Alert
              variant={actionMsg.type === "ok" ? "success" : "danger"}
              className="mt-4"
            >
              {actionMsg.text}
            </Alert>
          )}
        </div>
      )}
    </AdminPanel>
  );
}
