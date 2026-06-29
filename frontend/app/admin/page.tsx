"use client";

import { useCallback, useEffect, useState } from "react";
import { Bricolage_Grotesque } from "next/font/google";
import { SALE_PRICE_NGN } from "@/constants/pricing";
import { AccountLookup } from "@/components/admin/account-lookup";
import { BlogManager } from "@/components/admin/blog-manager";
import { DirectMessaging } from "@/components/admin/direct-messaging";
import { TrialInsightsTabs } from "@/components/admin/trial-insights-tabs";
import {
  adminLogin,
  clearAdminToken,
  generateAccess,
  getAdminToken,
  getLicenses,
  getOverview,
  getPayouts,
  getRecentUsers,
  getTrialActivity,
  getTrialStats,
  markPayoutProcessing,
  payPayout,
  setAdminToken,
  type AdminLicense,
  type AdminOverview,
  type PayoutRequest,
  type RecentAdminUser,
  type TrialActivity,
  type TrialStats,
} from "@/services/admin-api";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700"],
});

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

type DailyActivation = {
  date: string;
  count: number;
  label: string;
};

type ActivationData = {
  total: number;
  daily: DailyActivation[];
  peak: number;
  average: number;
  from: string;
  to: string;
  days: number;
};

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentAdminUser[]>([]);
  const [prefillLookupEmail, setPrefillLookupEmail] = useState<string | null>(null);
  const [trialStats, setTrialStats] = useState<TrialStats | null>(null);
  const [trialActivity, setTrialActivity] = useState<TrialActivity | null>(null);
  const [trialSectionOpen, setTrialSectionOpen] = useState(true);
  const [licenses, setLicenses] = useState<AdminLicense[]>([]);
  const [generateEmail, setGenerateEmail] = useState("");
  const [generateMsg, setGenerateMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [payingOut, setPayingOut] = useState<string | null>(null);
  const [payoutMsg, setPayoutMsg] = useState("");
  const [activations, setActivations] = useState<ActivationData | null>(null);
  const [activationsLoading, setActivationsLoading] = useState(false);
  const [activePreset, setActivePreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [headScripts, setHeadScripts] = useState("");
  const [bodyScripts, setBodyScripts] = useState("");
  const [scriptsSaving, setScriptsSaving] = useState(false);
  const [scriptsMsg, setScriptsMsg] = useState("");

  const [blogView, setBlogView] = useState<"list" | "editor">("list");
  const [blogPosts, setBlogPosts] = useState<
    Array<{
      id: string;
      title: string;
      slug: string;
      status: string;
      featured?: boolean;
      category?: string;
      read_time?: number;
      created_at: string;
    }>
  >([]);
  const [blogLoading, setBlogLoading] = useState(false);
  const [editingPost, setEditingPost] = useState<{ id: string } | null>(null);
  const [blogTitle, setBlogTitle] = useState("");
  const [blogSlug, setBlogSlug] = useState("");
  const [blogExcerpt, setBlogExcerpt] = useState("");
  const [blogContent, setBlogContent] = useState("");
  const [blogCoverImage, setBlogCoverImage] = useState("");
  const [blogCategory, setBlogCategory] = useState("");
  const [blogTags, setBlogTags] = useState("");
  const [blogMetaTitle, setBlogMetaTitle] = useState("");
  const [blogMetaDesc, setBlogMetaDesc] = useState("");
  const [blogStatus, setBlogStatus] = useState<"draft" | "published">("draft");
  const [blogFeatured, setBlogFeatured] = useState(false);
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogMsg, setBlogMsg] = useState("");

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

  const loadPayouts = useCallback(async () => {
    if (!getAdminToken()) return;
    try {
      const data = await getPayouts();
      setPayouts(data.payouts || []);
    } catch (err) {
      if (!handleSessionError(err)) {
        /* silent */
      }
    }
  }, [handleSessionError]);

  function getAdminHeaders(): HeadersInit {
    const currentToken = getAdminToken();
    return {
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    };
  }

  async function loadActivations(preset?: string, from?: string, to?: string) {
    setActivationsLoading(true);
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL}/admin/activations`;

      if (from && to) {
        url += `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      } else {
        const presetToUse = preset || "today";
        url += `?preset=${presetToUse}`;
      }

      const res = await fetch(url, { headers: getAdminHeaders() });

      if (res.ok) {
        const data = (await res.json()) as ActivationData;
        setActivations(data);
      } else {
        console.error("[loadActivations] failed with status:", res.status);
      }
    } catch (err) {
      console.error("[loadActivations] error:", err);
    } finally {
      setActivationsLoading(false);
    }
  }

  async function loadSiteSettings() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/site-settings`, {
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setHeadScripts(data.headScripts || "");
        setBodyScripts(data.bodyScripts || "");
      }
    } catch {}
  }

  async function saveScripts() {
    setScriptsSaving(true);
    setScriptsMsg("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/site-settings`, {
        method: "POST",
        headers: {
          ...getAdminHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ headScripts, bodyScripts }),
      });
      const data = await res.json();
      if (data.success) {
        setScriptsMsg("Scripts saved. Changes apply to every page within 60 seconds.");
      } else {
        setScriptsMsg(data.error || "Failed to save scripts.");
      }
    } catch {
      setScriptsMsg("Failed to save scripts.");
    } finally {
      setScriptsSaving(false);
    }
  }

  function generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  async function loadBlogPosts() {
    setBlogLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/blog/posts`, {
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setBlogPosts(data.posts || []);
      }
    } catch {
      /* silent */
    } finally {
      setBlogLoading(false);
    }
  }

  function openNewPost() {
    setEditingPost(null);
    setBlogTitle("");
    setBlogSlug("");
    setBlogExcerpt("");
    setBlogContent("");
    setBlogCoverImage("");
    setBlogCategory("");
    setBlogTags("");
    setBlogMetaTitle("");
    setBlogMetaDesc("");
    setBlogStatus("draft");
    setBlogFeatured(false);
    setBlogMsg("");
    setBlogView("editor");
  }

  async function openEditPost(post: { id: string; title?: string; slug?: string; excerpt?: string; cover_image?: string; category?: string; tags?: string[]; meta_title?: string; meta_description?: string; status?: string; featured?: boolean }) {
    setEditingPost(post);
    setBlogTitle(post.title || "");
    setBlogSlug(post.slug || "");
    setBlogExcerpt(post.excerpt || "");
    setBlogCoverImage(post.cover_image || "");
    setBlogCategory(post.category || "");
    setBlogTags((post.tags || []).join(", "));
    setBlogMetaTitle(post.meta_title || "");
    setBlogMetaDesc(post.meta_description || "");
    setBlogStatus((post.status as "draft" | "published") || "draft");
    setBlogFeatured(post.featured || false);
    setBlogMsg("");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/blog/posts/${post.id}`,
        { headers: getAdminHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setBlogContent(data.content || "");
      }
    } catch {
      /* silent */
    }

    setBlogView("editor");
  }

  async function saveBlogPost(publishNow?: boolean) {
    if (!blogTitle || !blogContent) {
      setBlogMsg("Title and content are required.");
      return;
    }

    setBlogSaving(true);
    setBlogMsg("");

    const payload = {
      title: blogTitle,
      slug: blogSlug || generateSlug(blogTitle),
      excerpt: blogExcerpt,
      content: blogContent,
      cover_image: blogCoverImage,
      category: blogCategory,
      tags: blogTags
        ? blogTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      meta_title: blogMetaTitle || blogTitle,
      meta_description: blogMetaDesc || blogExcerpt,
      status: publishNow ? "published" : blogStatus,
      featured: blogFeatured,
    };

    try {
      const url = editingPost
        ? `${process.env.NEXT_PUBLIC_API_URL}/admin/blog/posts/${editingPost.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/admin/blog/posts`;

      const res = await fetch(url, {
        method: editingPost ? "PUT" : "POST",
        headers: { ...getAdminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setBlogMsg(
          publishNow ? "Article published successfully." : "Article saved as draft."
        );
        if (publishNow) setBlogStatus("published");
        if (!editingPost && data.post) {
          setEditingPost(data.post);
        }
        await loadBlogPosts();
      } else {
        setBlogMsg(data.error || "Failed to save.");
      }
    } catch {
      setBlogMsg("Failed to save. Check your connection.");
    } finally {
      setBlogSaving(false);
    }
  }

  async function deleteBlogPost(id: string) {
    if (!window.confirm("Delete this article? This cannot be undone.")) return;

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/blog/posts/${id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      await loadBlogPosts();
      setBlogView("list");
    } catch {
      /* silent */
    }
  }

  const handleMarkProcessing = async (payoutId: string) => {
    setPayoutMsg("");
    try {
      const data = await markPayoutProcessing(payoutId);
      setPayoutMsg(data.message);
      await loadPayouts();
    } catch (err) {
      setPayoutMsg(err instanceof Error ? err.message : "Failed to update payout status.");
    }
  };

  const handlePayout = async (payout: PayoutRequest) => {
    const confirmed = window.confirm(
      `Mark ₦${payout.amount_ngn.toLocaleString()} as paid to ${payout.referrer_email}?\n\nAccount: ${payout.account_name}\nBank: ${payout.bank_name}\nAccount Number: ${payout.account_number}\n\nOnly click confirm AFTER you have completed the manual bank transfer. This will notify the affiliate that their payment has been sent.`
    );
    if (!confirmed) return;

    setPayingOut(payout.id);
    setPayoutMsg("");

    try {
      const data = await payPayout(payout.id);
      setPayoutMsg(data.message);
      await loadPayouts();
    } catch (err) {
      setPayoutMsg(err instanceof Error ? err.message : "Failed to mark payout as paid.");
    } finally {
      setPayingOut(null);
    }
  };

  const refreshDashboard = useCallback(async () => {
    if (!getAdminToken()) return;
    try {
      const licenseData = await getLicenses();
      setLicenses(licenseData.licenses);
    } catch (err) {
      if (!handleSessionError(err)) {
        /* ignore refresh errors */
      }
    }
  }, [handleSessionError]);

  useEffect(() => {
    if (!token) return;

    async function loadAdminData() {
      try {
        const [overviewData, recentData] = await Promise.all([
          getOverview(),
          getRecentUsers(),
        ]);
        setOverview(overviewData);
        setRecentUsers(recentData.users || []);
        await loadActivations("today");
        await loadSiteSettings();
        await loadPayouts();
        await loadBlogPosts();
      } catch (err) {
        if (!handleSessionError(err)) {
          /* silent fail */
        }
      }
    }

    void loadAdminData();
    void refreshDashboard();

    const overviewInterval = setInterval(() => void loadAdminData(), 60_000);
    const licenseInterval = setInterval(() => void refreshDashboard(), 30_000);
    return () => {
      clearInterval(overviewInterval);
      clearInterval(licenseInterval);
    };
  }, [token, refreshDashboard, handleSessionError, loadPayouts]);

  useEffect(() => {
    if (!token) return;

    async function loadTrialData() {
      try {
        const [statsData, activityData] = await Promise.all([
          getTrialStats(),
          getTrialActivity(),
        ]);
        setTrialStats(statsData);
        setTrialActivity(activityData);
      } catch (err) {
        if (!handleSessionError(err)) {
          /* ignore trial stats refresh errors */
        }
      }
    }

    void loadTrialData();
    const interval = setInterval(() => void loadTrialData(), 120_000);
    return () => clearInterval(interval);
  }, [token, handleSessionError]);

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
    setOverview(null);
    setRecentUsers([]);
    setTrialStats(null);
    setTrialActivity(null);
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
            LeadThur Admin
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
          LeadThur Admin
        </h1>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#A1A1B5] hover:bg-white/5"
        >
          Logout
        </button>
      </header>

      {/* ACTIVATION TRACKER */}
      <div
        className="mx-auto mt-8 max-w-6xl"
        style={{
          background: "#111118",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F2F1FF", margin: 0 }}>
              Activation Tracker
            </h3>
            <p style={{ fontSize: 11, color: "#555570", marginTop: 3 }}>
              Daily signups and activations over time
            </p>
          </div>
          {activations && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#555570" }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#10B981",
                  display: "inline-block",
                }}
              />
              Live data from Supabase
            </div>
          )}
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {[
              { label: "Today", value: "today" },
              { label: "Yesterday", value: "yesterday" },
              { label: "7 Days", value: "7days" },
              { label: "14 Days", value: "14days" },
              { label: "30 Days", value: "30days" },
              { label: "This Month", value: "thismonth" },
            ].map((preset) => (
              <button
                key={preset.value}
                onClick={() => {
                  setActivePreset(preset.value);
                  setShowCustom(false);
                  void loadActivations(preset.value);
                }}
                style={{
                  background:
                    activePreset === preset.value && !showCustom ? "#7C3AED" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${
                    activePreset === preset.value && !showCustom ? "#7C3AED" : "rgba(255,255,255,0.08)"
                  }`,
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: activePreset === preset.value && !showCustom ? "white" : "#8888A8",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  transition: "all 0.15s",
                }}
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(!showCustom)}
              style={{
                background: showCustom ? "#7C3AED" : "rgba(255,255,255,0.04)",
                border: `1px solid ${showCustom ? "#7C3AED" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: showCustom ? "white" : "#8888A8",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                transition: "all 0.15s",
              }}
            >
              Custom Range
            </button>
          </div>

          {showCustom && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: "#555570",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 5,
                  }}
                >
                  From
                </label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  style={{
                    background: "#0A0A10",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "#F2F1FF",
                    fontFamily: "Inter, sans-serif",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: "#555570",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 5,
                  }}
                >
                  To
                </label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  style={{
                    background: "#0A0A10",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "#F2F1FF",
                    fontFamily: "Inter, sans-serif",
                    outline: "none",
                  }}
                />
              </div>
              <button
                onClick={() => {
                  if (customFrom && customTo) {
                    void loadActivations(undefined, customFrom, customTo);
                  }
                }}
                disabled={!customFrom || !customTo}
                style={{
                  background: customFrom && customTo ? "#7C3AED" : "#1A1A24",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "white",
                  cursor: customFrom && customTo ? "pointer" : "not-allowed",
                  fontFamily: "Inter, sans-serif",
                  opacity: customFrom && customTo ? 1 : 0.5,
                }}
              >
                Apply
              </button>
            </div>
          )}

          {activationsLoading && (
            <div style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "#555570" }}>
              Loading activations...
            </div>
          )}

          {!activationsLoading && activations && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
                {[
                  { label: "Total Activations", value: activations.total, color: "#A78BFA", highlight: true },
                  { label: "Daily Average", value: activations.average, color: "#10B981", highlight: false },
                  { label: "Peak Day", value: activations.peak, color: "#F59E0B", highlight: false },
                  { label: "Days Tracked", value: activations.days, color: "#8888A8", highlight: false },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      background: stat.highlight ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${
                        stat.highlight ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.06)"
                      }`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 900,
                        color: stat.color,
                        lineHeight: 1,
                        marginBottom: 5,
                        letterSpacing: "-1px",
                      }}
                    >
                      {stat.value}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#555570",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                      }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {activations.daily.length > 0 ? (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#555570",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 12,
                    }}
                  >
                    Daily Breakdown
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 4,
                      height: 120,
                      paddingBottom: 24,
                      position: "relative",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {activations.daily.map((day) => {
                      const heightPercent = activations.peak > 0 ? (day.count / activations.peak) * 100 : 0;
                      const barHeight = Math.max(heightPercent * 0.96, day.count > 0 ? 4 : 0);
                      return (
                        <div
                          key={day.date}
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            height: "100%",
                            gap: 4,
                            position: "relative",
                          }}
                          title={`${day.label}: ${day.count} activation${day.count !== 1 ? "s" : ""}`}
                        >
                          {day.count > 0 && (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#A78BFA",
                                position: "absolute",
                                bottom: `${barHeight + 26}px`,
                                left: "50%",
                                transform: "translateX(-50%)",
                              }}
                            >
                              {day.count}
                            </div>
                          )}
                          <div
                            style={{
                              width: "100%",
                              height: `${barHeight}%`,
                              background:
                                day.count === activations.peak && day.count > 0
                                  ? "#7C3AED"
                                  : day.count > 0
                                    ? "rgba(124,58,237,0.45)"
                                    : "rgba(255,255,255,0.04)",
                              borderRadius: "4px 4px 0 0",
                              transition: "all 0.3s ease",
                              minHeight: day.count > 0 ? 4 : 0,
                              position: "absolute",
                              bottom: 20,
                            }}
                          />
                          <div
                            style={{
                              fontSize: 9,
                              color: "#555570",
                              position: "absolute",
                              bottom: 2,
                              left: "50%",
                              transform: "translateX(-50%)",
                              whiteSpace: "nowrap",
                              fontWeight: 600,
                            }}
                          >
                            {day.label.split(" ")[0]}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 16 }}>
                    {[...activations.daily].reverse().map((day) => (
                      <div
                        key={day.date}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 0",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          fontSize: 12,
                        }}
                      >
                        <span style={{ color: "#8888A8", fontWeight: 500 }}>{day.label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 80,
                              height: 4,
                              background: "rgba(255,255,255,0.06)",
                              borderRadius: 2,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: activations.peak > 0 ? `${(day.count / activations.peak) * 100}%` : "0%",
                                height: "100%",
                                background:
                                  day.count === activations.peak ? "#7C3AED" : "rgba(124,58,237,0.5)",
                                borderRadius: 2,
                              }}
                            />
                          </div>
                          <span
                            style={{
                              color: day.count > 0 ? "#F2F1FF" : "#555570",
                              fontWeight: 700,
                              minWidth: 20,
                              textAlign: "right",
                            }}
                          >
                            {day.count}
                          </span>
                          <span style={{ color: "#555570", fontSize: 10 }}>
                            {day.count === 1 ? "activation" : "activations"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "#555570" }}>
                  No activations found for this period. Try a wider date range.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* GLOBAL SCRIPTS MANAGER */}
      <div
        className="mx-auto max-w-6xl"
        style={{
          background: "#111118",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F2F1FF", margin: 0 }}>
              Global Scripts
            </h3>
            <p style={{ fontSize: 11, color: "#555570", marginTop: 3 }}>
              Inject tracking codes and scripts into every page sitewide
            </p>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <div
            style={{
              background: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.15)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 20,
              fontSize: 12,
              color: "#FBBF24",
              lineHeight: 1.6,
            }}
          >
            Scripts added here inject into every page on leadthur.com. A broken script can affect
            the entire site. Test on staging before saving to production. Keep a backup before
            making changes.
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: "#8888A8",
                textTransform: "uppercase" as const,
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Head Scripts
            </label>
            <p style={{ fontSize: 11, color: "#555570", marginBottom: 8, lineHeight: 1.5 }}>
              Paste Google Analytics, Meta Pixel, or any script that belongs inside the head tag.
            </p>
            <textarea
              value={headScripts}
              onChange={(e) => setHeadScripts(e.target.value)}
              placeholder={`Paste the full tracking code exactly as provided.\n\nInclude the outer <script> tags.\n\nExample Meta Pixel:\n<script>\n  fbq('init', 'YOUR_PIXEL_ID');\n  fbq('track', 'PageView');\n</script>\n<noscript>...</noscript>`}
              rows={8}
              style={{
                width: "100%",
                background: "#0A0A10",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: 12,
                color: "#F2F1FF",
                fontFamily: "monospace",
                resize: "vertical" as const,
                outline: "none",
                lineHeight: 1.6,
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: "#8888A8",
                textTransform: "uppercase" as const,
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Body Scripts
            </label>
            <p style={{ fontSize: 11, color: "#555570", marginBottom: 8, lineHeight: 1.5 }}>
              Paste scripts that belong before the closing body tag. Use for chat widgets or
              heatmaps.
            </p>
            <textarea
              value={bodyScripts}
              onChange={(e) => setBodyScripts(e.target.value)}
              placeholder={`<!-- Example: Meta Pixel -->\n<script>\n  fbq('init', 'YOUR_PIXEL_ID');\n  fbq('track', 'PageView');\n</script>`}
              rows={8}
              style={{
                width: "100%",
                background: "#0A0A10",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: 12,
                color: "#F2F1FF",
                fontFamily: "monospace",
                resize: "vertical" as const,
                outline: "none",
                lineHeight: 1.6,
              }}
            />
          </div>

          <button
            onClick={saveScripts}
            disabled={scriptsSaving}
            style={{
              background: scriptsSaving ? "#1A1A24" : "#7C3AED",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              fontSize: 13,
              fontWeight: 700,
              cursor: scriptsSaving ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif",
              opacity: scriptsSaving ? 0.7 : 1,
              transition: "all 0.2s",
            }}
          >
            {scriptsSaving ? "Saving..." : "Save Scripts"}
          </button>

          {scriptsMsg && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                background: scriptsMsg.includes("saved")
                  ? "rgba(16,185,129,0.08)"
                  : "rgba(239,68,68,0.08)",
                border: `1px solid ${
                  scriptsMsg.includes("saved")
                    ? "rgba(16,185,129,0.2)"
                    : "rgba(239,68,68,0.2)"
                }`,
                borderRadius: 8,
                fontSize: 12,
                color: scriptsMsg.includes("saved") ? "#10B981" : "#EF4444",
                fontWeight: 600,
              }}
            >
              {scriptsMsg}
            </div>
          )}
        </div>
      </div>

      {overview && (() => {
        const isDemoMode =
          process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
          window.location.hostname === "staging.leadthur.com";

        return (
        <div className="mx-auto mt-8 max-w-6xl" style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "#F0EFFF",
                margin: 0,
                letterSpacing: -0.5,
              }}
            >
              Overview
            </h2>
            <span style={{ fontSize: 11, color: "#555575" }}>
              Updates every 60 seconds
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
            }}
          >
            {[
              {
                label: "Total Users",
                value: isDemoMode ? 447 : overview.totalUsers,
                sub: `${overview.newUsersToday} new today`,
                color: "#7C3AED",
              },
              {
                label: "Active Users",
                value: isDemoMode ? 389 : overview.activeUsers,
                sub: `${overview.suspendedUsers} suspended`,
                color: "#10B981",
              },
              {
                label: "New This Week",
                value: isDemoMode ? 61 : overview.newUsersThisWeek,
                sub: "activated accounts",
                color: "#0891B2",
              },
              {
                label: "Est. Revenue",
                value: isDemoMode
                  ? "₦6,705,000"
                  : `₦${overview.estimatedRevenue.toLocaleString()}`,
                sub: isDemoMode
                  ? "at ₦15,000 per user"
                  : `at ₦${SALE_PRICE_NGN.toLocaleString()} per user`,
                color: "#F59E0B",
              },
              {
                label: "Paid Searches",
                value: isDemoMode ? "5,400" : overview.totalSearches,
                sub: "by paying users",
                color: "#7C3AED",
              },
              {
                label: "Trial Searches",
                value: isDemoMode ? "1,163" : overview.totalTrialSearches,
                sub: "free preview usage",
                color: "#6B7280",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "#111118",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12,
                  padding: "16px 14px",
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: stat.color,
                    letterSpacing: -1,
                    marginBottom: 4,
                    fontFamily: "Inter, sans-serif",
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#F0EFFF",
                    marginBottom: 3,
                  }}
                >
                  {stat.label}
                </div>
                <div style={{ fontSize: 10, color: "#555575" }}>{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
        );
      })()}

      {recentUsers.length > 0 && (
        <div
          className="mx-auto max-w-6xl"
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F0EFFF", margin: 0 }}>
              Recent Users
            </h3>
            <span style={{ fontSize: 11, color: "#555575" }}>Last 10 signups</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr style={{ background: "#0D0D16" }}>
                  {["Email", "Status", "Searches", "Joined", "Action"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontWeight: 700,
                        color: "#555575",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                  <tr
                    key={user.email}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "#F0EFFF",
                        fontWeight: 500,
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {user.email}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          background: user.is_suspended
                            ? "rgba(239,68,68,0.1)"
                            : user.activated
                              ? "rgba(16,185,129,0.1)"
                              : "rgba(251,191,36,0.1)",
                          color: user.is_suspended
                            ? "#EF4444"
                            : user.activated
                              ? "#10B981"
                              : "#FBBF24",
                          padding: "3px 10px",
                          borderRadius: 100,
                          fontSize: 10,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {user.is_suspended
                          ? "Suspended"
                          : user.activated
                            ? "Active"
                            : "Pending"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#7878A0" }}>
                      {user.searches_used || 0}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "#7878A0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(user.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setPrefillLookupEmail(user.email);
                          document
                            .getElementById("account-lookup")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                        style={{
                          background: "rgba(124,58,237,0.1)",
                          border: "1px solid rgba(124,58,237,0.2)",
                          color: "#A78BFA",
                          padding: "5px 12px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "Inter, sans-serif",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div
        className="mx-auto mt-8 max-w-6xl"
        style={{
          background: "#111118",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F2F1FF", margin: 0 }}>
            Affiliate Payouts
          </h3>
          <span
            style={{
              background:
                payouts.filter((p) => p.status === "pending").length > 0
                  ? "rgba(251,191,36,0.15)"
                  : "rgba(255,255,255,0.06)",
              color:
                payouts.filter((p) => p.status === "pending").length > 0
                  ? "#FBBF24"
                  : "#7878A0",
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 100,
            }}
          >
            {payouts.filter((p) => p.status === "pending").length} pending
          </span>
        </div>

        {payoutMsg && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(16,185,129,0.08)",
              borderBottom: "1px solid rgba(16,185,129,0.15)",
              fontSize: 13,
              color: "#10B981",
              fontWeight: 600,
            }}
          >
            {payoutMsg}
          </div>
        )}

        {payouts.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              fontSize: 13,
              color: "#7878A0",
            }}
          >
            No payout requests yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#0D0D16" }}>
                  {["Email", "Amount", "Bank", "Account", "Status", "Date", "Action"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 14px",
                          textAlign: "left",
                          fontWeight: 700,
                          color: "#7878A0",
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr
                    key={payout.id}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <td style={{ padding: "12px 14px", color: "#F2F1FF", fontWeight: 500 }}>
                      {payout.referrer_email}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#10B981", fontWeight: 700 }}>
                      ₦{payout.amount_ngn.toLocaleString()}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#8888A8" }}>
                      {payout.bank_name}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#8888A8" }}>
                      {payout.account_number} — {payout.account_name}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          background:
                            payout.status === "paid"
                              ? "rgba(16,185,129,0.1)"
                              : payout.status === "failed"
                                ? "rgba(239,68,68,0.1)"
                                : payout.status === "processing"
                                  ? "rgba(59,130,246,0.1)"
                                  : "rgba(251,191,36,0.1)",
                          color:
                            payout.status === "paid"
                              ? "#10B981"
                              : payout.status === "failed"
                                ? "#EF4444"
                                : payout.status === "processing"
                                  ? "#60A5FA"
                                  : "#FBBF24",
                          padding: "3px 10px",
                          borderRadius: 100,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "capitalize",
                        }}
                      >
                        {payout.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "#7878A0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(payout.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {payout.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => void handleMarkProcessing(payout.id)}
                            style={{
                              background: "transparent",
                              color: "#60A5FA",
                              border: "1px solid rgba(59,130,246,0.35)",
                              borderRadius: 6,
                              padding: "6px 10px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              fontFamily: "Inter, sans-serif",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Processing
                          </button>
                        )}
                        {(payout.status === "pending" ||
                          payout.status === "processing" ||
                          payout.status === "failed") && (
                          <button
                            type="button"
                            onClick={() => void handlePayout(payout)}
                            disabled={payingOut === payout.id}
                            style={{
                              background:
                                payingOut === payout.id
                                  ? "rgba(16,185,129,0.1)"
                                  : "#10B981",
                              color: "white",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 14px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: payingOut === payout.id ? "not-allowed" : "pointer",
                              fontFamily: "Inter, sans-serif",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {payingOut === payout.id ? "Saving..." : "Mark Paid"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {trialStats && (
        <div
          className="mx-auto mt-8 max-w-6xl"
          style={{
            background: "#FAFAFA",
            border: "1px solid #E5E5E5",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div
            role="button"
            tabIndex={0}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              marginBottom: trialSectionOpen ? 20 : 0,
            }}
            onClick={() => setTrialSectionOpen(!trialSectionOpen)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setTrialSectionOpen(!trialSectionOpen);
              }
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#111111",
                  margin: 0,
                  marginBottom: 3,
                }}
              >
                Free Trial Activity
              </h3>
              <p style={{ fontSize: 12, color: "#888888", margin: 0 }}>
                Track who is testing LeadThur before buying
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  background: "#7C3AED",
                  color: "white",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: 100,
                }}
              >
                {trialStats.trialsToday} today
              </div>
              <span
                style={{
                  color: "#888888",
                  fontSize: 18,
                  transform: trialSectionOpen ? "rotate(180deg)" : "rotate(0)",
                  transition: "transform 0.2s",
                }}
              >
                ⌄
              </span>
            </div>
          </div>

          {trialSectionOpen && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                {[
                  {
                    label: "Total Trial Searches",
                    value: trialStats.totalTrials,
                    color: "#7C3AED",
                  },
                  {
                    label: "Searches Today",
                    value: trialStats.trialsToday,
                    color: "#0891B2",
                  },
                  {
                    label: "This Week",
                    value: trialStats.trialsThisWeek,
                    color: "#059669",
                  },
                  {
                    label: "This Month",
                    value: trialStats.trialsThisMonth,
                    color: "#D97706",
                  },
                  {
                    label: "New Licenses Today",
                    value: trialStats.licensesToday,
                    color: "#059669",
                  },
                  {
                    label: "Est. Conversion Rate",
                    value: `${trialStats.conversionRate}%`,
                    color: "#7C3AED",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #EEEEEE",
                      borderRadius: 10,
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: stat.color,
                        marginBottom: 3,
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 11, color: "#888888", fontWeight: 600 }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {trialActivity && trialActivity.dailyActivity.length > 0 && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #EEEEEE",
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#555555",
                      marginBottom: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Last 7 Days
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 8,
                      height: 80,
                    }}
                  >
                    {trialActivity.dailyActivity.map((day) => {
                      const maxCount = Math.max(
                        ...trialActivity.dailyActivity.map((d) => d.count)
                      );
                      const height =
                        maxCount > 0
                          ? Math.max((day.count / maxCount) * 70, day.count > 0 ? 8 : 2)
                          : 2;
                      const label = new Date(day.date).toLocaleDateString("en-GB", {
                        weekday: "short",
                      });
                      return (
                        <div
                          key={day.date}
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <div style={{ fontSize: 10, color: "#888888", fontWeight: 700 }}>
                            {day.count || ""}
                          </div>
                          <div
                            style={{
                              width: "100%",
                              height: `${height}px`,
                              background: day.count > 0 ? "#7C3AED" : "#EEEEEE",
                              borderRadius: 4,
                              transition: "height 0.3s ease",
                              opacity: day.count > 0 ? 1 : 0.4,
                            }}
                          />
                          <div style={{ fontSize: 9, color: "#AAAAAA" }}>{label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {trialActivity && trialActivity.topQueries.length > 0 && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #EEEEEE",
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#555555",
                      marginBottom: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Top Searches This Month
                  </p>
                  {trialActivity.topQueries.map((q) => {
                    const maxCount = trialActivity.topQueries[0]?.count || 1;
                    const width = (q.count / maxCount) * 100;
                    return (
                      <div key={q.query} style={{ marginBottom: 10 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "#333333",
                              fontWeight: 500,
                              textTransform: "capitalize",
                            }}
                          >
                            {q.query}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "#7C3AED",
                              fontWeight: 700,
                            }}
                          >
                            {q.count}x
                          </span>
                        </div>
                        <div
                          style={{
                            height: 4,
                            background: "#F0F0F0",
                            borderRadius: 100,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${width}%`,
                              background: "linear-gradient(90deg, #7C3AED, #A78BFA)",
                              borderRadius: 100,
                              transition: "width 0.5s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {trialActivity && trialActivity.recentTrials.length > 0 && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #EEEEEE",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #EEEEEE",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#555555",
                        margin: 0,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Recent Trial Searches
                    </p>
                    <span style={{ fontSize: 11, color: "#888888" }}>Last 50</span>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#F8F8F8" }}>
                          {["Business Type", "Location", "Results", "Time"].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: "10px 14px",
                                textAlign: "left",
                                fontWeight: 700,
                                color: "#888888",
                                fontSize: 10,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {trialActivity.recentTrials.map((trial, i) => (
                          <tr
                            key={trial.id}
                            style={{
                              borderTop: "1px solid #F0F0F0",
                              background: i % 2 === 0 ? "#ffffff" : "#FAFAFA",
                            }}
                          >
                            <td
                              style={{
                                padding: "10px 14px",
                                color: "#111111",
                                fontWeight: 600,
                                textTransform: "capitalize",
                              }}
                            >
                              {trial.query}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                color: "#555555",
                                textTransform: "capitalize",
                              }}
                            >
                              {trial.location}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <span
                                style={{
                                  background:
                                    trial.total_found > 0
                                      ? "rgba(16,185,129,0.1)"
                                      : "rgba(0,0,0,0.06)",
                                  color: trial.total_found > 0 ? "#059669" : "#888888",
                                  padding: "2px 8px",
                                  borderRadius: 100,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {trial.total_found || 0}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                color: "#888888",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {new Date(trial.created_at).toLocaleString("en-GB", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="mx-auto mt-8 max-w-6xl">
        <TrialInsightsTabs onSessionExpired={handleLogout} />
        <AccountLookup
          onSessionExpired={handleLogout}
          prefillEmail={prefillLookupEmail}
          onPrefillConsumed={() => setPrefillLookupEmail(null)}
        />
        <DirectMessaging onSessionExpired={handleLogout} />
        <BlogManager
          blogView={blogView}
          setBlogView={setBlogView}
          blogPosts={blogPosts}
          blogLoading={blogLoading}
          loadBlogPosts={loadBlogPosts}
          openNewPost={openNewPost}
          openEditPost={openEditPost}
          deleteBlogPost={deleteBlogPost}
          blogTitle={blogTitle}
          setBlogTitle={setBlogTitle}
          blogSlug={blogSlug}
          setBlogSlug={setBlogSlug}
          blogExcerpt={blogExcerpt}
          setBlogExcerpt={setBlogExcerpt}
          blogContent={blogContent}
          setBlogContent={setBlogContent}
          blogCoverImage={blogCoverImage}
          setBlogCoverImage={setBlogCoverImage}
          blogCategory={blogCategory}
          setBlogCategory={setBlogCategory}
          blogTags={blogTags}
          setBlogTags={setBlogTags}
          blogMetaTitle={blogMetaTitle}
          setBlogMetaTitle={setBlogMetaTitle}
          blogMetaDesc={blogMetaDesc}
          setBlogMetaDesc={setBlogMetaDesc}
          blogStatus={blogStatus}
          blogFeatured={blogFeatured}
          setBlogFeatured={setBlogFeatured}
          blogSaving={blogSaving}
          blogMsg={blogMsg}
          editingPost={editingPost}
          saveBlogPost={saveBlogPost}
          generateSlug={generateSlug}
        />
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
