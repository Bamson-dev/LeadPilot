"use client";

import { useCallback, useEffect, useState } from "react";
import { Bricolage_Grotesque } from "next/font/google";
import { AccountLookup } from "@/components/admin/account-lookup";
import {
  adminLogin,
  clearAdminToken,
  generateAccess,
  getAdminStats,
  getAdminToken,
  getLicenses,
  setAdminToken,
  type AdminLicense,
  type AdminStats,
} from "@/services/admin-api";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700"],
});

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [licenses, setLicenses] = useState<AdminLicense[]>([]);
  const [generateEmail, setGenerateEmail] = useState("");
  const [generateMsg, setGenerateMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(getAdminToken());
  }, []);

  const handleSessionError = useCallback((err: unknown) => {
    if (err instanceof Error && err.message === "SESSION_EXPIRED") {
      clearAdminToken();
      setToken(null);
      return true;
    }
    return false;
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!getAdminToken()) return;
    try {
      const [statsData, licenseData] = await Promise.all([getAdminStats(), getLicenses()]);
      setStats(statsData);
      setLicenses(licenseData.licenses);
    } catch (err) {
      if (!handleSessionError(err)) {
        console.error(err);
      }
    }
  }, [handleSessionError]);

  useEffect(() => {
    if (!token) return;
    void refreshDashboard();
    const interval = setInterval(() => void refreshDashboard(), 30_000);
    return () => clearInterval(interval);
  }, [token, refreshDashboard]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const data = await adminLogin(loginEmail.trim(), loginPassword);
      setAdminToken(data.token);
      setToken(data.token);
      setLoginPassword("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setToken(null);
    setStats(null);
    setLicenses([]);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerateMsg(null);
    setLoading(true);
    try {
      const result = (await generateAccess(generateEmail.trim())) as {
        message?: string;
        key?: string;
      };
      setGenerateMsg({
        type: "ok",
        text: result.message ?? `Access sent. Key: ${result.key ?? "created"}`,
      });
      setGenerateEmail("");
      await refreshDashboard();
    } catch (err) {
      if (!handleSessionError(err)) {
        setGenerateMsg({
          type: "err",
          text: err instanceof Error ? err.message : "Failed to generate access",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-4">
        <form
          onSubmit={handleLogin}
          className="glass w-full max-w-md rounded-2xl p-8"
        >
          <h1 className={`${bricolage.className} text-2xl font-bold text-[#F4F4FF]`}>
            LeadPilot Admin
          </h1>
          <p className="mt-2 text-sm text-[#6B6B80]">Sign in to manage licenses</p>

          <label className="mt-6 block text-xs font-medium text-[#6B6B80]">Email</label>
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[#F4F4FF] outline-none focus:border-[#7C3AED]"
            required
          />

          <label className="mt-4 block text-xs font-medium text-[#6B6B80]">Password</label>
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[#F4F4FF] outline-none focus:border-[#7C3AED]"
            required
          />

          {loginError && (
            <p className="mt-4 text-sm text-red-400" role="alert">
              {loginError}
            </p>
          )}

          <button
            type="submit"
            disabled={loginLoading}
            className="mt-6 w-full rounded-lg bg-[#7C3AED] py-2.5 font-semibold text-white transition hover:bg-[#6D28D9] disabled:opacity-60"
          >
            {loginLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090B] px-4 py-8 sm:px-6">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <h1 className={`${bricolage.className} text-2xl font-bold text-[#F4F4FF]`}>
          LeadPilot Admin
        </h1>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#A1A1B5] hover:bg-white/5"
        >
          Logout
        </button>
      </header>

      <div className="mx-auto mt-8 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Licenses", value: stats?.totalLicenses ?? "—" },
          { label: "Activated Licenses", value: stats?.activatedLicenses ?? "—" },
          { label: "Total Searches", value: stats?.totalSearches ?? "—" },
          { label: "Licenses Today", value: stats?.licensesToday ?? "—" },
        ].map((card) => (
          <div key={card.label} className="glass rounded-xl p-5">
            <p className="text-xs text-[#6B6B80]">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-[#F4F4FF]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <AccountLookup onSessionExpired={handleLogout} />
      </div>

      <div className="mx-auto mt-8 max-w-6xl">
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[#F4F4FF]">Generate Access</h2>
          <form onSubmit={handleGenerate} className="mt-4 space-y-3">
            <label className="text-xs text-[#6B6B80]">Buyer Email Address</label>
            <input
              type="email"
              value={generateEmail}
              onChange={(e) => setGenerateEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[#F4F4FF] outline-none focus:border-[#7C3AED]"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#7C3AED] py-2.5 font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-60"
            >
              Generate and Send Access
            </button>
          </form>
          {generateMsg && (
            <p
              className={`mt-3 text-sm ${generateMsg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}
            >
              {generateMsg.text}
            </p>
          )}
        </section>
      </div>

      <section className="glass mx-auto mt-8 max-w-6xl overflow-hidden rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[#F4F4FF]">Recent Licenses</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-[#6B6B80]">
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4">License Key</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Activated Date</th>
                <th className="pb-3 pr-4">Payment</th>
                <th className="pb-3 pr-4">Searches</th>
                <th className="pb-3 pr-4">Exports</th>
                <th className="pb-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((row) => (
                <tr key={row.id} className="border-b border-white/5 text-[#C4C4D4]">
                  <td className="py-3 pr-4">{row.email}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{row.key}</td>
                  <td className="py-3 pr-4">
                    {row.is_suspended ? (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
                        Suspended
                      </span>
                    ) : row.activated ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                        Activated
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-[#9CA3AF]">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">{formatDate(row.activated_at)}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full bg-[#7C3AED]/15 px-2 py-0.5 text-xs text-[#C4B5FD]">
                      {row.payment_channel === "paystack" ? "Paystack" : "Bank Transfer"}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {row.search_count ?? row.searches_used} / {row.monthly_search_limit ?? 100}
                  </td>
                  <td className="py-3 pr-4">{row.exports_used}</td>
                  <td className="py-3">{formatDate(row.created_at)}</td>
                </tr>
              ))}
              {licenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#6B6B80]">
                    No licenses yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
