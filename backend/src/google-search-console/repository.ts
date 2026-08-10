import { supabase } from "../database/client";
import { getGscSiteUrl } from "./config";
import type { GscConnection, GscConnectionStatus, GscPageRow, GscQueryRow } from "./types";

export async function getActiveConnection(): Promise<GscConnection | null> {
  const siteUrl = getGscSiteUrl();
  const { data, error } = await supabase
    .from("google_search_console_connections")
    .select("*")
    .eq("site_url", siteUrl)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GscConnection | null) || null;
}

export async function upsertConnection(
  patch: Partial<GscConnection> & { site_url: string }
): Promise<GscConnection> {
  const existing = await getActiveConnection();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    provider: "google_search_console",
    site_url: patch.site_url,
    updated_at: now,
  };
  if (existing?.id) row.id = existing.id;

  const fields: Array<keyof GscConnection> = [
    "google_account_email",
    "refresh_token_encrypted",
    "scopes",
    "status",
    "connected_at",
    "last_sync_at",
    "last_successful_sync_at",
    "next_sync_at",
    "last_error_at",
    "last_error_code",
    "last_error_message",
    "rows_collected",
  ];
  for (const key of fields) {
    if (patch[key] !== undefined) row[key] = patch[key];
    else if (existing && existing[key] !== undefined) row[key] = existing[key];
  }
  if (!existing) {
    row.created_at = now;
    row.status = patch.status || "disconnected";
    row.scopes = patch.scopes || [];
    row.rows_collected = patch.rows_collected ?? 0;
  }

  const { data, error } = await supabase
    .from("google_search_console_connections")
    .upsert(row, { onConflict: "site_url" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as GscConnection;
}

export async function markConnectionStatus(
  status: GscConnectionStatus,
  error?: { code?: string; message?: string }
): Promise<void> {
  const siteUrl = getGscSiteUrl();
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (error) {
    updates.last_error_at = new Date().toISOString();
    updates.last_error_code = error.code || null;
    updates.last_error_message = error.message?.slice(0, 500) || null;
  }
  const { error: dbError } = await supabase
    .from("google_search_console_connections")
    .update(updates)
    .eq("site_url", siteUrl);
  if (dbError) throw new Error(dbError.message);
}

export async function clearRefreshToken(): Promise<void> {
  const siteUrl = getGscSiteUrl();
  const { error } = await supabase
    .from("google_search_console_connections")
    .update({
      refresh_token_encrypted: null,
      status: "disconnected",
      updated_at: new Date().toISOString(),
    })
    .eq("site_url", siteUrl);
  if (error) throw new Error(error.message);
}

export async function createOAuthState(input: {
  stateHash: string;
  adminEmail: string;
  expiresAt: string;
}): Promise<void> {
  const { error } = await supabase.from("google_search_console_oauth_states").insert({
    state_hash: input.stateHash,
    admin_email: input.adminEmail,
    expires_at: input.expiresAt,
  });
  if (error) throw new Error(error.message);
}

export async function consumeOAuthState(
  stateHash: string
): Promise<{ adminEmail: string } | null> {
  const { data, error } = await supabase
    .from("google_search_console_oauth_states")
    .select("*")
    .eq("state_hash", stateHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (data.consumed_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  const { error: updateError } = await supabase
    .from("google_search_console_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("consumed_at", null);
  if (updateError) throw new Error(updateError.message);
  return { adminEmail: data.admin_email as string };
}

export async function purgeExpiredOAuthStates(): Promise<void> {
  await supabase
    .from("google_search_console_oauth_states")
    .delete()
    .lt("expires_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
}

export async function startSyncRun(
  trigger: "scheduler" | "manual" | "connect"
): Promise<string> {
  const { data, error } = await supabase
    .from("google_search_console_sync_runs")
    .insert({
      site_url: getGscSiteUrl(),
      trigger,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function finishSyncRun(
  id: string,
  result: {
    status: "success" | "failed";
    rowsUpserted?: number;
    errorCode?: string;
    errorMessage?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from("google_search_console_sync_runs")
    .update({
      status: result.status,
      finished_at: new Date().toISOString(),
      rows_upserted: result.rowsUpserted || 0,
      error_code: result.errorCode || null,
      error_message: result.errorMessage?.slice(0, 500) || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function hasRunningSync(): Promise<boolean> {
  const { data, error } = await supabase
    .from("google_search_console_sync_runs")
    .select("id")
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .limit(1);
  if (error) throw new Error(error.message);
  return (data || []).length > 0;
}

export async function upsertDailyRows(
  rows: Array<{
    report_date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>
): Promise<number> {
  if (!rows.length) return 0;
  const siteUrl = getGscSiteUrl();
  const payload = rows.map((r) => ({
    site_url: siteUrl,
    ...r,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("google_search_console_daily")
    .upsert(payload, { onConflict: "site_url,report_date" });
  if (error) throw new Error(error.message);
  return payload.length;
}

export async function upsertPageRows(rows: GscPageRow[]): Promise<number> {
  if (!rows.length) return 0;
  const siteUrl = getGscSiteUrl();
  const payload = rows.map((r) => ({
    site_url: siteUrl,
    report_date: r.report_date,
    page: r.page,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
    updated_at: new Date().toISOString(),
  }));
  // Chunk to avoid payload limits
  let count = 0;
  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500);
    const { error } = await supabase
      .from("google_search_console_pages")
      .upsert(chunk, { onConflict: "site_url,report_date,page" });
    if (error) throw new Error(error.message);
    count += chunk.length;
  }
  return count;
}

export async function upsertQueryRows(rows: GscQueryRow[]): Promise<number> {
  if (!rows.length) return 0;
  const siteUrl = getGscSiteUrl();
  const payload = rows.map((r) => ({
    site_url: siteUrl,
    report_date: r.report_date,
    query: r.query,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
    updated_at: new Date().toISOString(),
  }));
  let count = 0;
  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500);
    const { error } = await supabase
      .from("google_search_console_queries")
      .upsert(chunk, { onConflict: "site_url,report_date,query" });
    if (error) throw new Error(error.message);
    count += chunk.length;
  }
  return count;
}

export async function pruneOldStats(retentionDays = 400): Promise<void> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const siteUrl = getGscSiteUrl();
  await supabase
    .from("google_search_console_daily")
    .delete()
    .eq("site_url", siteUrl)
    .lt("report_date", cutoffStr);
  await supabase
    .from("google_search_console_pages")
    .delete()
    .eq("site_url", siteUrl)
    .lt("report_date", cutoffStr);
  await supabase
    .from("google_search_console_queries")
    .delete()
    .eq("site_url", siteUrl)
    .lt("report_date", cutoffStr);
}

function rangeStart(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function getOverview(days: number): Promise<{
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  days: number;
}> {
  const siteUrl = getGscSiteUrl();
  const { data, error } = await supabase
    .from("google_search_console_daily")
    .select("clicks, impressions, ctr, position")
    .eq("site_url", siteUrl)
    .gte("report_date", rangeStart(days));
  if (error) throw new Error(error.message);
  const rows = data || [];
  const clicks = rows.reduce((a, r) => a + Number(r.clicks || 0), 0);
  const impressions = rows.reduce((a, r) => a + Number(r.impressions || 0), 0);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const position =
    rows.length > 0
      ? rows.reduce((a, r) => a + Number(r.position || 0), 0) / rows.length
      : 0;
  return { clicks, impressions, ctr, position, days };
}

export async function getTrends(days: number) {
  const siteUrl = getGscSiteUrl();
  const { data, error } = await supabase
    .from("google_search_console_daily")
    .select("report_date, clicks, impressions, ctr, position")
    .eq("site_url", siteUrl)
    .gte("report_date", rangeStart(days))
    .order("report_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getTopPages(
  days: number,
  sortBy: "clicks" | "impressions" | "ctr" | "position" = "clicks",
  limit = 50
) {
  const siteUrl = getGscSiteUrl();
  const { data, error } = await supabase
    .from("google_search_console_pages")
    .select("page, clicks, impressions, ctr, position")
    .eq("site_url", siteUrl)
    .gte("report_date", rangeStart(days));
  if (error) throw new Error(error.message);

  const map = new Map<
    string,
    { page: string; clicks: number; impressions: number; positionSum: number; n: number }
  >();
  for (const row of data || []) {
    const key = String(row.page);
    const cur = map.get(key) || {
      page: key,
      clicks: 0,
      impressions: 0,
      positionSum: 0,
      n: 0,
    };
    cur.clicks += Number(row.clicks || 0);
    cur.impressions += Number(row.impressions || 0);
    cur.positionSum += Number(row.position || 0);
    cur.n += 1;
    map.set(key, cur);
  }

  const aggregated = [...map.values()].map((r) => ({
    page: r.page,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
    position: r.n > 0 ? r.positionSum / r.n : 0,
  }));

  aggregated.sort((a, b) => {
    if (sortBy === "position") return a.position - b.position;
    return Number(b[sortBy]) - Number(a[sortBy]);
  });
  return aggregated.slice(0, limit);
}

export async function getTopQueries(
  days: number,
  sortBy: "clicks" | "impressions" | "ctr" | "position" = "clicks",
  limit = 50
) {
  const siteUrl = getGscSiteUrl();
  const { data, error } = await supabase
    .from("google_search_console_queries")
    .select("query, clicks, impressions, ctr, position")
    .eq("site_url", siteUrl)
    .gte("report_date", rangeStart(days));
  if (error) throw new Error(error.message);

  const map = new Map<
    string,
    { query: string; clicks: number; impressions: number; positionSum: number; n: number }
  >();
  for (const row of data || []) {
    const key = String(row.query);
    const cur = map.get(key) || {
      query: key,
      clicks: 0,
      impressions: 0,
      positionSum: 0,
      n: 0,
    };
    cur.clicks += Number(row.clicks || 0);
    cur.impressions += Number(row.impressions || 0);
    cur.positionSum += Number(row.position || 0);
    cur.n += 1;
    map.set(key, cur);
  }

  const aggregated = [...map.values()].map((r) => ({
    query: r.query,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
    position: r.n > 0 ? r.positionSum / r.n : 0,
  }));

  aggregated.sort((a, b) => {
    if (sortBy === "position") return a.position - b.position;
    return Number(b[sortBy]) - Number(a[sortBy]);
  });
  return aggregated.slice(0, limit);
}

export async function countStoredRows(): Promise<number> {
  const siteUrl = getGscSiteUrl();
  const [d, p, q] = await Promise.all([
    supabase
      .from("google_search_console_daily")
      .select("id", { count: "exact", head: true })
      .eq("site_url", siteUrl),
    supabase
      .from("google_search_console_pages")
      .select("id", { count: "exact", head: true })
      .eq("site_url", siteUrl),
    supabase
      .from("google_search_console_queries")
      .select("id", { count: "exact", head: true })
      .eq("site_url", siteUrl),
  ]);
  return (d.count || 0) + (p.count || 0) + (q.count || 0);
}
