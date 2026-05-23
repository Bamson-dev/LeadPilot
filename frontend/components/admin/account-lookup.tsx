"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  lookupLicense,
  resendAccess,
  resetDevices,
  resetSearches,
  suspendAccount,
  unsuspendAccount,
  updateDeviceLimit,
  updateSearchLimit,
  type AdminLicense,
} from "@/services/admin-api";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function truncateKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 12)}...`;
}

function statusBadge(license: AdminLicense) {
  if (license.is_suspended) {
    return (
      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
        Suspended
      </span>
    );
  }
  if (license.activated) {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
        Activated
      </span>
    );
  }
  return (
    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-[#9CA3AF]">
      Pending
    </span>
  );
}

interface AccountLookupProps {
  onSessionExpired: () => void;
}

export function AccountLookup({ onSessionExpired }: AccountLookupProps) {
  const [searchEmail, setSearchEmail] = useState("");
  const [license, setLicense] = useState<AdminLicense | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);

  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [actionLoading, setActionLoading] = useState(false);

  const [showLimitForm, setShowLimitForm] = useState(false);
  const [newLimit, setNewLimit] = useState(100);
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmResetDevices, setConfirmResetDevices] = useState(false);
  const [showDeviceLimitForm, setShowDeviceLimitForm] = useState(false);
  const [newMaxDevices, setNewMaxDevices] = useState(2);

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
    setNewLimit(result.licenses[0].monthly_search_limit ?? 100);
    setNewMaxDevices(result.licenses[0].max_devices ?? 2);
  };

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
    setShowLimitForm(false);
    setShowSuspendForm(false);
    setConfirmReset(false);
    setConfirmResetDevices(false);
    setShowDeviceLimitForm(false);

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
  const maxDevices = license?.max_devices ?? 2;

  return (
    <section className="glass mx-auto max-w-6xl rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-[#F4F4FF]">Account Lookup</h2>
      <p className="mt-1 text-sm text-[#6B6B80]">
        Search any buyer by email and manage their account from here.
      </p>

      <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label className="text-xs text-[#6B6B80]">Search by email address</label>
          <input
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
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[#F4F4FF] outline-none focus:border-[#7C3AED]"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="mt-6 sm:mt-0 sm:self-end rounded-lg bg-[#7C3AED] px-6 py-2.5 font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-60"
        >
          {searching ? (
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </button>
      </form>

      {notFound && (
        <p className="mt-4 text-sm text-[#9CA3AF]">
          No account found for that email address.
        </p>
      )}

      {license && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#6B6B80]">Email</dt>
              <dd className="font-medium text-[#F4F4FF]">{license.email}</dd>
            </div>
            <div>
              <dt className="text-[#6B6B80]">License Key</dt>
              <dd className="font-mono text-[#C4B5FD]">{truncateKey(license.key)}</dd>
            </div>
            <div>
              <dt className="text-[#6B6B80]">Status</dt>
              <dd className="mt-0.5">{statusBadge(license)}</dd>
            </div>
            <div>
              <dt className="text-[#6B6B80]">Payment Channel</dt>
              <dd className="mt-0.5">
                <span className="rounded-full bg-[#7C3AED]/15 px-2 py-0.5 text-xs text-[#C4B5FD]">
                  {license.payment_channel === "paystack" ? "Paystack" : "Bank Transfer"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[#6B6B80]">Searches Used</dt>
              <dd className="text-[#F4F4FF]">
                {searchCount} of {monthlyLimit}
              </dd>
            </div>
            <div>
              <dt className="text-[#6B6B80]">Max Devices Allowed</dt>
              <dd className="font-semibold text-[#F4F4FF]">{maxDevices}</dd>
            </div>
            <div>
              <dt className="text-[#6B6B80]">Activated Date</dt>
              <dd className="text-[#F4F4FF]">{formatDate(license.activated_at)}</dd>
            </div>
            <div>
              <dt className="text-[#6B6B80]">Created Date</dt>
              <dd className="text-[#F4F4FF]">{formatDate(license.created_at)}</dd>
            </div>
            {license.is_suspended && license.suspension_reason && (
              <div className="sm:col-span-2">
                <dt className="text-[#6B6B80]">Suspension Reason</dt>
                <dd className="text-red-300">{license.suspension_reason}</dd>
              </div>
            )}
          </dl>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() =>
                runAction(() => resendAccess(license.email) as Promise<{ message?: string }>)
              }
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-[#A1A1B5] hover:bg-white/5 disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend Email"}
            </button>

            <button
              type="button"
              disabled={actionLoading}
              onClick={() => {
                setShowLimitForm((v) => !v);
                setShowSuspendForm(false);
                setNewLimit(monthlyLimit);
              }}
              className="rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-medium text-white hover:bg-[#6D28D9] disabled:opacity-50"
            >
              Update Limit
            </button>

            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setConfirmReset(true)}
              className="rounded-lg bg-blue-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              Reset Searches
            </button>

            <button
              type="button"
              disabled={actionLoading}
              onClick={() => {
                setConfirmResetDevices(true);
                setShowDeviceLimitForm(false);
                setShowLimitForm(false);
                setShowSuspendForm(false);
              }}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-[#A1A1B5] hover:bg-white/5 disabled:opacity-50"
            >
              Reset Devices
            </button>

            <button
              type="button"
              disabled={actionLoading}
              onClick={() => {
                setShowDeviceLimitForm((v) => !v);
                setShowLimitForm(false);
                setShowSuspendForm(false);
                setConfirmResetDevices(false);
                setNewMaxDevices(maxDevices);
              }}
              className="rounded-lg border border-[#7C3AED]/50 px-4 py-2 text-sm font-medium text-[#C4B5FD] hover:bg-[#7C3AED]/10 disabled:opacity-50"
            >
              Update Device Limit
            </button>

            {!license.is_suspended ? (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  setShowSuspendForm((v) => !v);
                  setShowLimitForm(false);
                }}
                className="rounded-lg bg-red-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                Suspend
              </button>
            ) : (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  runAction(
                    () => unsuspendAccount(license.email) as Promise<{ message?: string }>
                  )
                }
                className="rounded-lg bg-emerald-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                Unsuspend
              </button>
            )}
          </div>

          {showLimitForm && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#7C3AED]/30 bg-[#7C3AED]/5 p-3">
              <input
                type="number"
                min={0}
                max={100000}
                value={newLimit}
                onChange={(e) => setNewLimit(Number(e.target.value))}
                className="w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F4F4FF]"
              />
              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  runAction(
                    () =>
                      updateSearchLimit(license.email, newLimit) as Promise<{
                        message?: string;
                      }>
                  ).then(() => setShowLimitForm(false))
                }
                className="rounded-lg bg-[#7C3AED] px-4 py-1.5 text-sm text-white"
              >
                Save
              </button>
            </div>
          )}

          {showSuspendForm && !license.is_suspended && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <input
                type="text"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Reason (optional)"
                className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F4F4FF]"
              />
              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  runAction(
                    () =>
                      suspendAccount(license.email, suspendReason) as Promise<{
                        message?: string;
                      }>
                  ).then(() => {
                    setShowSuspendForm(false);
                    setSuspendReason("");
                  })
                }
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm text-white"
              >
                Confirm Suspend
              </button>
            </div>
          )}

          {confirmResetDevices && (
            <div className="mt-4 rounded-lg border border-white/15 bg-white/[0.02] p-3 text-sm text-[#A1A1B5]">
              <p>
                This clears both saved devices. The user will need to log in again from
                their devices. Are you sure?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() =>
                    runAction(
                      () => resetDevices(license.email) as Promise<{ message?: string }>
                    ).then(() => setConfirmResetDevices(false))
                  }
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-[#F4F4FF]"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetDevices(false)}
                  className="rounded-lg border border-white/15 px-3 py-1.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showDeviceLimitForm && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#7C3AED]/30 bg-[#7C3AED]/5 p-3">
              <label className="text-sm text-[#A1A1B5]">New device limit</label>
              <input
                type="number"
                min={1}
                max={10}
                value={newMaxDevices}
                onChange={(e) => setNewMaxDevices(Number(e.target.value))}
                className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F4F4FF]"
              />
              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  runAction(
                    () =>
                      updateDeviceLimit(license.email, newMaxDevices) as Promise<{
                        message?: string;
                      }>
                  ).then(() => setShowDeviceLimitForm(false))
                }
                className="rounded-lg bg-[#7C3AED] px-4 py-1.5 text-sm text-white"
              >
                Save
              </button>
            </div>
          )}

          {confirmReset && (
            <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm text-[#A1A1B5]">
              <p>Reset search count to 0 for this user?</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() =>
                    runAction(
                      () => resetSearches(license.email) as Promise<{ message?: string }>
                    ).then(() => setConfirmReset(false))
                  }
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-white"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-lg border border-white/15 px-3 py-1.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {actionMsg && (
            <p
              className={`mt-4 text-sm ${actionMsg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}
            >
              {actionMsg.text}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
