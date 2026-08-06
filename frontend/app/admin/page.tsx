"use client";

import { useCallback, useEffect, useState } from "react";
import { Bricolage_Grotesque } from "next/font/google";
import { SALE_PRICE_NGN } from "@/constants/pricing";
import { AccountLookup } from "@/components/admin/account-lookup";
import {
  ActivationTrackerSection,
  type ActivationData,
} from "@/components/admin/activation-tracker-section";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import {
  AdminSection,
  AdminSectionHeader,
  adminLabelClass,
  adminSectionBodyClass,
  adminTableClass,
  adminTableHeadRowClass,
  adminTableRowClass,
} from "@/components/admin/admin-ui";
import { BlogManager } from "@/components/admin/blog-manager";
import { DirectMessaging } from "@/components/admin/direct-messaging";
import { GlobalScriptsSection } from "@/components/admin/global-scripts-section";
import { TrialActivitySection } from "@/components/admin/trial-activity-section";
import { TrialInsightsTabs } from "@/components/admin/trial-insights-tabs";
import { TrialBroadcastPanel } from "@/components/admin/trial-broadcast-panel";
import { AdminQueueStatusBar } from "@/components/admin/queue-status-bar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/status-badge";
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
      <AdminLoginForm
        email={loginEmail}
        password={loginPassword}
        error={loginError}
        loading={loginLoading}
        onEmailChange={setLoginEmail}
        onPasswordChange={setLoginPassword}
        onSubmit={handleLogin}
        titleClassName={`${bricolage.className} text-2xl font-bold text-[var(--lt-text)]`}
      />
    );
  }

  return (
    <main className="admin-rc1 min-h-screen bg-[var(--lt-bg)] px-4 py-8 text-[var(--lt-text)] sm:px-6">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div>
          <h1 className={`${bricolage.className} text-2xl font-bold text-[var(--lt-text)]`}>
            LeadThur Admin
          </h1>
          <p className="mt-1 text-xs text-[var(--lt-text-muted)]">
            Existing admin workflows only — JWT console, not product AppShell.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </header>

      <AdminSectionNav />

      <div className="mx-auto max-w-6xl" id="admin-queue">
        <AdminQueueStatusBar enabled={Boolean(token)} />
      </div>

      <ActivationTrackerSection
        activations={activations}
        activationsLoading={activationsLoading}
        activePreset={activePreset}
        showCustom={showCustom}
        customFrom={customFrom}
        customTo={customTo}
        setActivePreset={setActivePreset}
        setShowCustom={setShowCustom}
        setCustomFrom={setCustomFrom}
        setCustomTo={setCustomTo}
        loadActivations={loadActivations}
      />

      <GlobalScriptsSection
        headScripts={headScripts}
        bodyScripts={bodyScripts}
        scriptsSaving={scriptsSaving}
        scriptsMsg={scriptsMsg}
        setHeadScripts={setHeadScripts}
        setBodyScripts={setBodyScripts}
        saveScripts={saveScripts}
      />

      {overview && (() => {
        const isDemoMode =
          process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
          window.location.hostname === "staging.leadthur.com";

        return (
          <section id="admin-overview" className="mx-auto mb-7 mt-8 max-w-6xl">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="m-0 text-base font-extrabold tracking-tight text-[var(--lt-text)]">
                Overview
              </h2>
              <span className="text-[11px] text-[var(--lt-text-subtle)]">
                Updates every 60 seconds
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  label: "Total Users",
                  value: isDemoMode ? 447 : overview.totalUsers,
                  sub: `${overview.newUsersToday} new today`,
                  colorClass: "text-[var(--lt-accent)]",
                },
                {
                  label: "Active Users",
                  value: isDemoMode ? 389 : overview.activeUsers,
                  sub: `${overview.suspendedUsers} suspended`,
                  colorClass: "text-[var(--lt-success)]",
                },
                {
                  label: "New This Week",
                  value: isDemoMode ? 61 : overview.newUsersThisWeek,
                  sub: "activated accounts",
                  colorClass: "text-[var(--lt-cyan)]",
                },
                {
                  label: "Est. Revenue",
                  value: isDemoMode
                    ? "₦6,705,000"
                    : `₦${overview.estimatedRevenue.toLocaleString()}`,
                  sub: isDemoMode
                    ? "at ₦15,000 per user"
                    : `at ₦${SALE_PRICE_NGN.toLocaleString()} per user`,
                  colorClass: "text-[var(--lt-warning)]",
                },
                {
                  label: "Paid Searches",
                  value: isDemoMode ? "5,400" : overview.totalSearches,
                  sub: "by paying users",
                  colorClass: "text-[var(--lt-accent)]",
                },
                {
                  label: "Trial Searches",
                  value: isDemoMode ? "1,163" : overview.totalTrialSearches,
                  sub: "free preview usage",
                  colorClass: "text-[var(--lt-text-muted)]",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] px-3.5 py-4"
                >
                  <div
                    className={`mb-1 text-[28px] font-black leading-none tracking-tight ${stat.colorClass}`}
                  >
                    {stat.value}
                  </div>
                  <div className="mb-0.5 text-xs font-bold text-[var(--lt-text)]">{stat.label}</div>
                  <div className="text-[10px] text-[var(--lt-text-subtle)]">{stat.sub}</div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {recentUsers.length > 0 && (
        <AdminSection id="admin-users" className="mb-6">
          <AdminSectionHeader
            title="Recent Users"
            description="Last 10 signups"
          />
          <div className="overflow-x-auto">
            <table className={adminTableClass}>
              <thead>
                <tr className={adminTableHeadRowClass}>
                  {["Email", "Status", "Searches", "Joined", "Action"].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                  <tr key={user.email} className={adminTableRowClass}>
                    <td className="max-w-[180px] truncate px-3.5 py-3 font-medium text-[var(--lt-text)]">
                      {user.email}
                    </td>
                    <td className="px-3.5 py-3">
                      <StatusBadge
                        status={
                          (user.is_suspended
                            ? "error"
                            : user.activated
                              ? "active"
                              : "processing") as StatusBadgeStatus
                        }
                        label={
                          user.is_suspended
                            ? "Suspended"
                            : user.activated
                              ? "Active"
                              : "Pending"
                        }
                      />
                    </td>
                    <td className="px-3.5 py-3 text-[var(--lt-text-muted)]">
                      {user.searches_used || 0}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 text-[var(--lt-text-muted)]">
                      {new Date(user.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td className="px-3.5 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => {
                          setPrefillLookupEmail(user.email);
                          document
                            .getElementById("account-lookup")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>
      )}

      <AdminSection id="admin-payouts" className="mb-6">
        <AdminSectionHeader
          title="Affiliate Payouts"
          action={
            <Chip
              className={
                payouts.filter((p) => p.status === "pending").length > 0
                  ? "border-[var(--lt-warning)]/30 bg-[var(--lt-warning-soft)] text-[var(--lt-warning)]"
                  : undefined
              }
            >
              {payouts.filter((p) => p.status === "pending").length} pending
            </Chip>
          }
        />

        {payoutMsg && (
          <Alert variant="success" className="rounded-none border-x-0 border-t-0 text-sm font-semibold">
            {payoutMsg}
          </Alert>
        )}

        {payouts.length === 0 ? (
          <div className={adminSectionBodyClass}>
            <EmptyState title="No payout requests yet." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={adminTableClass}>
              <thead>
                <tr className={adminTableHeadRowClass}>
                  {["Email", "Amount", "Bank", "Account", "Status", "Date", "Action"].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className={adminTableRowClass}>
                    <td className="px-3.5 py-3 font-medium text-[var(--lt-text)]">
                      {payout.referrer_email}
                    </td>
                    <td className="px-3.5 py-3 font-bold text-[var(--lt-success)]">
                      ₦{payout.amount_ngn.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3 text-[var(--lt-text-muted)]">{payout.bank_name}</td>
                    <td className="px-3.5 py-3 text-[var(--lt-text-muted)]">
                      {payout.account_number} — {payout.account_name}
                    </td>
                    <td className="px-3.5 py-3">
                      <StatusBadge
                        status={
                          (payout.status === "paid"
                            ? "active"
                            : payout.status === "failed"
                              ? "error"
                              : payout.status === "processing"
                                ? "enriched"
                                : "processing") as StatusBadgeStatus
                        }
                        label={payout.status}
                        className="capitalize"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 text-[var(--lt-text-muted)]">
                      {new Date(payout.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {payout.status === "pending" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] text-[var(--lt-cyan)]"
                            onClick={() => void handleMarkProcessing(payout.id)}
                          >
                            Processing
                          </Button>
                        )}
                        {(payout.status === "pending" ||
                          payout.status === "processing" ||
                          payout.status === "failed") && (
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => void handlePayout(payout)}
                            disabled={payingOut === payout.id}
                          >
                            {payingOut === payout.id ? "Saving..." : "Mark Paid"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      {trialStats && (
        <TrialActivitySection
          trialStats={trialStats}
          trialActivity={trialActivity}
          trialSectionOpen={trialSectionOpen}
          setTrialSectionOpen={setTrialSectionOpen}
        />
      )}

      <div className="mx-auto mt-8 max-w-6xl" id="admin-tools">
        <TrialInsightsTabs onSessionExpired={handleLogout} />
        <TrialBroadcastPanel onSessionExpired={handleLogout} />
        <AccountLookup
          onSessionExpired={handleLogout}
          prefillEmail={prefillLookupEmail}
          onPrefillConsumed={() => setPrefillLookupEmail(null)}
        />
        <DirectMessaging onSessionExpired={handleLogout} />
      </div>

      <div className="mx-auto mt-8 max-w-6xl" id="admin-blog">
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

      <div className="mx-auto mt-8 max-w-6xl" id="admin-access">
        <Panel>
          <PanelHeader>
            <PanelTitle>Generate Access</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <form onSubmit={handleGenerate} className="space-y-3">
              <label className={adminLabelClass}>Buyer Email Address</label>
              <Input
                type="email"
                value={generateEmail}
                onChange={(e) => setGenerateEmail(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                Generate and Send Access
              </Button>
            </form>
            {generateMsg && (
              <p
                className={`mt-3 text-sm ${generateMsg.type === "ok" ? "text-[var(--lt-success)]" : "text-[var(--lt-danger)]"}`}
              >
                {generateMsg.text}
              </p>
            )}
          </PanelContent>
        </Panel>
      </div>

      <AdminSection id="admin-licenses" className="mb-6 p-0">
        <AdminSectionHeader title="Recent Licenses" />
        <div className={adminSectionBodyClass}>
          <div className="overflow-x-auto">
            <table className={`${adminTableClass} min-w-[900px]`}>
              <thead>
                <tr className={adminTableHeadRowClass}>
                  <th className="px-3 py-2 pr-4">Email</th>
                  <th className="px-3 py-2 pr-4">License Key</th>
                  <th className="px-3 py-2 pr-4">Status</th>
                  <th className="px-3 py-2 pr-4">Activated Date</th>
                  <th className="px-3 py-2 pr-4">Payment</th>
                  <th className="px-3 py-2 pr-4">Searches</th>
                  <th className="px-3 py-2 pr-4">Exports</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((row) => (
                  <tr key={row.id} className={adminTableRowClass}>
                    <td className="px-3 py-3 pr-4 text-[var(--lt-text)]">{row.email}</td>
                    <td className="px-3 py-3 pr-4 font-mono text-xs text-[var(--lt-text-muted)]">
                      {row.key}
                    </td>
                    <td className="px-3 py-3 pr-4">
                      <StatusBadge
                        status={
                          (row.is_suspended
                            ? "error"
                            : row.activated
                              ? "active"
                              : "paused") as StatusBadgeStatus
                        }
                        label={
                          row.is_suspended
                            ? "Suspended"
                            : row.activated
                              ? "Activated"
                              : "Pending"
                        }
                      />
                    </td>
                    <td className="px-3 py-3 pr-4 text-[var(--lt-text-muted)]">
                      {formatDate(row.activated_at)}
                    </td>
                    <td className="px-3 py-3 pr-4">
                      <StatusBadge status="replied" label={row.payment_channel === "paystack" ? "Paystack" : "Bank Transfer"} />
                    </td>
                    <td className="px-3 py-3 pr-4 text-[var(--lt-text-muted)]">
                      {row.search_count ?? row.searches_used} / {row.monthly_search_limit ?? 100}
                    </td>
                    <td className="px-3 py-3 pr-4 text-[var(--lt-text-muted)]">{row.exports_used}</td>
                    <td className="px-3 py-3 text-[var(--lt-text-muted)]">{formatDate(row.created_at)}</td>
                  </tr>
                ))}
                {licenses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[var(--lt-text-subtle)]">
                      No licenses yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AdminSection>
    </main>
  );
}
